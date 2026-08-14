import { EmailTemplateContractRegistry } from '@/modules/notifications/application/templates/email-template-contract.registry';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface ValidatedEmailTemplateSource {
  key: string;
  version: number;
  filePath: string;
}

const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\s*params\.([a-zA-Z0-9_]+)\s*\}\}/g;
const FORBIDDEN_HTML_PATTERN = /<(script|form|iframe)\b/i;

export class EmailTemplateSourceValidator {
  static validateAll(
    templatesRoot = join(process.cwd(), 'email-templates'),
  ): ReadonlyArray<ValidatedEmailTemplateSource> {
    const contracts = EmailTemplateContractRegistry.list();
    const expectedPaths = new Set<string>();
    const validated = contracts.map(contract => {
      const filePath = join(templatesRoot, contract.key, `v${contract.version}`, 'template.html');
      expectedPaths.add(relative(templatesRoot, filePath));

      if (!existsSync(filePath)) {
        throw new Error(`Email template source is missing: ${relative(templatesRoot, filePath)}.`);
      }

      const html = readFileSync(filePath, 'utf8');
      this.validateHtml(contract.key, contract.version, contract.parameterNames, html);

      return {
        key: contract.key,
        version: contract.version,
        filePath,
      };
    });

    const sourcePaths = readdirSync(templatesRoot, { recursive: true, encoding: 'utf8' })
      .filter(path => path.endsWith('template.html'))
      .map(path => path.replaceAll('\\', '/'));

    const unexpectedPath = sourcePaths.find(path => !expectedPaths.has(path));

    if (unexpectedPath) {
      throw new Error(`Email template source has no registered contract: ${unexpectedPath}.`);
    }

    return validated;
  }

  static validateHtml(
    templateKey: string,
    templateVersion: number,
    parameterNames: ReadonlyArray<string>,
    html: string,
  ): void {
    const reference = `${templateKey}:v${templateVersion}`;

    if (!/^<!doctype html>/i.test(html.trimStart())) {
      throw new Error(`Email template ${reference} must declare an HTML doctype.`);
    }

    if (!/<html\b[^>]*\blang="pt-BR"/i.test(html)) {
      throw new Error(`Email template ${reference} must declare lang="pt-BR".`);
    }

    if (!/<title>[^<]+<\/title>/i.test(html)) {
      throw new Error(`Email template ${reference} must include a non-empty title.`);
    }

    if (!/role="presentation"/i.test(html)) {
      throw new Error(`Email template ${reference} must use presentation tables.`);
    }

    if (!/display\s*:\s*none/i.test(html)) {
      throw new Error(`Email template ${reference} must include a hidden preheader.`);
    }

    if (FORBIDDEN_HTML_PATTERN.test(html)) {
      throw new Error(`Email template ${reference} contains a forbidden HTML element.`);
    }

    const images = html.match(/<img\b[\s\S]*?>/gi) ?? [];
    const imageWithoutAlt = images.some(image => !/\balt="[^"]*"/i.test(image));

    if (imageWithoutAlt) {
      throw new Error(`Email template ${reference} contains an image without alt text.`);
    }

    const insecureImageSource = images.some(image => {
      const source = image.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2];

      return !source?.startsWith('https://');
    });

    if (insecureImageSource) {
      throw new Error(`Email template ${reference} contains a non-HTTPS or local image source.`);
    }

    const links = html.match(/<a\b[\s\S]*?>/gi) ?? [];
    const invalidLinkTarget = links.some(link => {
      const target = link.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];

      return !target || (!target.startsWith('https://') && !/^\{\{\s*params\.[a-zA-Z0-9_]+\s*\}\}$/.test(target));
    });

    if (invalidLinkTarget) {
      throw new Error(`Email template ${reference} contains a non-HTTPS or local link.`);
    }

    const placeholders = new Set(Array.from(html.matchAll(TEMPLATE_PLACEHOLDER_PATTERN), match => match[1]));
    const expected = new Set(parameterNames);
    const unknown = [...placeholders].filter(name => !expected.has(name));
    const unused = [...expected].filter(name => !placeholders.has(name));

    if (unknown.length > 0) {
      throw new Error(`Email template ${reference} uses unknown params: ${unknown.sort().join(', ')}.`);
    }

    if (unused.length > 0) {
      throw new Error(`Email template ${reference} does not use declared params: ${unused.sort().join(', ')}.`);
    }
  }
}

import { ProcessRoles } from '@/common/models/constants/process-role.constants';
import { assertProcessRole } from '@/app/shared/assert-process-role';

describe('assertProcessRole', () => {
  const originalRole = process.env.PROCESS_ROLE;

  beforeEach(() => {
    delete process.env.PROCESS_ROLE;
  });

  afterAll(() => {
    if (originalRole === undefined) {
      delete process.env.PROCESS_ROLE;
    } else {
      process.env.PROCESS_ROLE = originalRole;
    }
  });

  it('defaults to the API role', () => {
    expect(() => assertProcessRole(ProcessRoles.API)).not.toThrow();
  });

  it('rejects a mismatched entrypoint role', () => {
    process.env.PROCESS_ROLE = ProcessRoles.WORKER;

    expect(() => assertProcessRole(ProcessRoles.API)).toThrow('Process role mismatch: expected api, received worker.');
  });

  it('rejects the worker entrypoint when configured as API', () => {
    process.env.PROCESS_ROLE = ProcessRoles.API;

    expect(() => assertProcessRole(ProcessRoles.WORKER)).toThrow(
      'Process role mismatch: expected worker, received api.',
    );
  });
});

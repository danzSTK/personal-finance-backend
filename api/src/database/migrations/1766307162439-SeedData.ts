import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedData1766307162439 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Inserir usuário
    await queryRunner.query(`
      INSERT INTO users (id, name, email, created_at)
      VALUES ('c174e580-f987-4055-a056-3bfd1549d2a8', 'Daniel Félix', 'daniel@email.com', now())
    `);

    // Inserir contas
    await queryRunner.query(`
      INSERT INTO accounts (id, user_id, account_type, name, initial_balance, created_at) VALUES
      ('901326ba-96df-4a20-a32b-de6688f40632', 'c174e580-f987-4055-a056-3bfd1549d2a8', 'CHECKING', 'Conta Nubank', 2500.00, now()),
      ('9223bc25-96e8-48c9-aace-bdb20620e0c8', 'c174e580-f987-4055-a056-3bfd1549d2a8', 'CREDIT_CARD', 'Cartão Nubank', 0.00, now())
    `);

    // Inserir categorias
    await queryRunner.query(`
      INSERT INTO categories (id, user_id, name, label, type) VALUES
      ('d80faa91-4cc1-42fe-b317-532c6080c726', 'c174e580-f987-4055-a056-3bfd1549d2a8', 'Salário', 'Salário', 'INCOME'),
      ('16446f9f-8da6-49ad-8f77-bb209cf71160', 'c174e580-f987-4055-a056-3bfd1549d2a8', 'Moradia', 'Moradia', 'EXPENSE'),
      ('49b46894-adc7-4441-982b-0149f869c451', 'c174e580-f987-4055-a056-3bfd1549d2a8', 'Alimentação', 'Alimentação', 'EXPENSE'),
      ('7d2874e2-ee40-4242-bfb8-ac7144d2fa14', 'c174e580-f987-4055-a056-3bfd1549d2a8', 'Assinaturas', 'Assinaturas', 'EXPENSE')
    `);

    // Inserir transações
    await queryRunner.query(`
      INSERT INTO transactions (user_id, account_id, category_id, amount, date, description, created_at) VALUES
      ('c174e580-f987-4055-a056-3bfd1549d2a8', '901326ba-96df-4a20-a32b-de6688f40632', 'd80faa91-4cc1-42fe-b317-532c6080c726', 4500.00, '2025-01-05', 'Salário Janeiro', now()),
      ('c174e580-f987-4055-a056-3bfd1549d2a8', '901326ba-96df-4a20-a32b-de6688f40632', '16446f9f-8da6-49ad-8f77-bb209cf71160', 1500.00, '2025-01-06', 'Aluguel', now()),
      ('c174e580-f987-4055-a056-3bfd1549d2a8', '9223bc25-96e8-48c9-aace-bdb20620e0c8', '49b46894-adc7-4441-982b-0149f869c451', 85.90, '2025-01-07', 'Ifood', now()),
      ('c174e580-f987-4055-a056-3bfd1549d2a8', '9223bc25-96e8-48c9-aace-bdb20620e0c8', '7d2874e2-ee40-4242-bfb8-ac7144d2fa14', 39.90, '2025-01-08', 'Spotify', now())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM transactions`);
    await queryRunner.query(`DELETE FROM categories`);
    await queryRunner.query(`DELETE FROM accounts`);
    await queryRunner.query(`DELETE FROM users`);
  }
}

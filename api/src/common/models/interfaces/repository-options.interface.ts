import { EntityManager } from 'typeorm';

export interface IRepositoryOptions {
  manager?: EntityManager;
}

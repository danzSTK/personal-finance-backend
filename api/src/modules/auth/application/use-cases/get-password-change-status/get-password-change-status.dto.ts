export interface GetPasswordChangeStatusInput {
  userId: string;
}

export type GetPasswordChangeStatusOutput =
  | {
      status: true;
    }
  | {
      status: false;
      retryAfterSeconds: number;
    };

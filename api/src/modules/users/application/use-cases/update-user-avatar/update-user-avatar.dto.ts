export interface UpdateUserAvatarInput {
  userId: string;
  bytes: Uint8Array;
}

export interface UpdateUserAvatarOutput {
  assetId: string;
  url: string;
}

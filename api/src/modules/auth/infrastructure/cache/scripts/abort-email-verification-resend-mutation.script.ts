export const ABORT_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT = String.raw`
local current_token = redis.call('GET', KEYS[1])

if current_token == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return { 1 }
end

return { 0 }
`;

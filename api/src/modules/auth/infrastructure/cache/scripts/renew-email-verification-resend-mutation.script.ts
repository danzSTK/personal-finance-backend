export const RENEW_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT = `
local pending_key = KEYS[1]
local mutation_token = ARGV[1]
local mutation_ttl_ms = tonumber(ARGV[2])

local current_token = redis.call('GET', pending_key)
if current_token == false or current_token ~= mutation_token then
  return { 0 }
end

local renewed = redis.call('PEXPIRE', pending_key, mutation_ttl_ms)
if renewed ~= 1 then
  return { 0 }
end

return { 1 }
`;

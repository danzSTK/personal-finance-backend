export const BEGIN_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT = String.raw`
local manual_resends_key = KEYS[1]
local cooldown_key = KEYS[2]
local pending_key = KEYS[3]

local now_ms = tonumber(ARGV[1])
local manual_window_ms = tonumber(ARGV[2])
local manual_limit = tonumber(ARGV[3])
local mutation_token = ARGV[4]
local mutation_ttl_ms = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', manual_resends_key, '-inf', now_ms - manual_window_ms)

local manual_count = redis.call('ZCARD', manual_resends_key)
local cooldown_pttl = redis.call('PTTL', cooldown_key)
local pending_pttl = redis.call('PTTL', pending_key)

if cooldown_pttl == -1 or pending_pttl == -1 then
  return { 9 }
end

local daily_retry_ms = 0
if manual_count >= manual_limit then
  local oldest = redis.call('ZRANGE', manual_resends_key, 0, 0, 'WITHSCORES')
  if #oldest ~= 2 then
    return { 9 }
  end
  daily_retry_ms = tonumber(oldest[2]) + manual_window_ms - now_ms
end

local restriction_code = 0
local retry_after_ms = 0
local restriction_rank = 0

local function consider(code, wait_ms, rank)
  if wait_ms > retry_after_ms or (wait_ms == retry_after_ms and wait_ms > 0 and rank > restriction_rank) then
    restriction_code = code
    retry_after_ms = wait_ms
    restriction_rank = rank
  end
end

consider(1, math.max(0, cooldown_pttl), 1)
consider(2, math.max(0, daily_retry_ms), 2)
consider(3, math.max(0, pending_pttl), 3)

if retry_after_ms > 0 then
  return { 1, restriction_code, retry_after_ms, manual_count }
end

local acquired = redis.call('SET', pending_key, mutation_token, 'NX', 'PX', mutation_ttl_ms)
if acquired == false then
  local retry_ms = redis.call('PTTL', pending_key)
  if retry_ms <= 0 then
    return { 9 }
  end
  return { 1, 3, retry_ms, manual_count }
end

return { 0, manual_count }
`;

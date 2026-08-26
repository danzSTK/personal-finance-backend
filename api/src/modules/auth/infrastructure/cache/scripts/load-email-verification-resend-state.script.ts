export const LOAD_EMAIL_VERIFICATION_RESEND_STATE_SCRIPT = String.raw`
local manual_resends_key = KEYS[1]
local cooldown_key = KEYS[2]
local last_send_key = KEYS[3]
local pending_key = KEYS[4]

local now_ms = tonumber(ARGV[1])
local manual_window_ms = tonumber(ARGV[2])
local manual_limit = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', manual_resends_key, '-inf', now_ms - manual_window_ms)

local manual_count = redis.call('ZCARD', manual_resends_key)
local manual_remaining = math.max(0, manual_limit - manual_count)
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

local last_send = redis.call('GET', last_send_key) or ''

if retry_after_ms > 0 then
  return { 1, restriction_code, retry_after_ms, manual_count, manual_remaining, last_send }
end

return { 0, manual_count, manual_remaining, last_send }
`;

export const COMPLETE_EMAIL_VERIFICATION_LOGICAL_SEND_SCRIPT = String.raw`
local manual_resends_key = KEYS[1]
local cooldown_key = KEYS[2]
local last_send_key = KEYS[3]
local pending_key = KEYS[4]

local now_ms = tonumber(ARGV[1])
local origin = ARGV[2]
local challenge_id = ARGV[3]
local logical_send_at_ms = tonumber(ARGV[4])
local manual_window_ms = tonumber(ARGV[5])
local initial_cooldown_ms = tonumber(ARGV[6])
local max_cooldown_ms = tonumber(ARGV[7])
local mutation_token = ARGV[8]

if origin ~= 'AUTOMATIC' and origin ~= 'MANUAL_RESEND' then
  return { 9 }
end

redis.call('ZREMRANGEBYSCORE', manual_resends_key, '-inf', now_ms - manual_window_ms)

if origin == 'MANUAL_RESEND' then
  redis.call('ZADD', manual_resends_key, 'NX', logical_send_at_ms, challenge_id)
end

local manual_count = redis.call('ZCARD', manual_resends_key)
local cooldown_duration_ms = initial_cooldown_ms
if origin == 'MANUAL_RESEND' then
  cooldown_duration_ms = math.min(initial_cooldown_ms * math.pow(2, manual_count), max_cooldown_ms)
end

local requested_cooldown_until_ms = logical_send_at_ms + cooldown_duration_ms
local current_cooldown_until = redis.call('GET', cooldown_key)
local effective_cooldown_until_ms = requested_cooldown_until_ms

if current_cooldown_until ~= false then
  local parsed_current = tonumber(current_cooldown_until)
  if parsed_current == nil then
    return { 9 }
  end
  effective_cooldown_until_ms = math.max(parsed_current, requested_cooldown_until_ms)
end

local cooldown_remaining_ms = effective_cooldown_until_ms - now_ms
if cooldown_remaining_ms > 0 then
  redis.call('SET', cooldown_key, effective_cooldown_until_ms, 'PX', cooldown_remaining_ms)
elseif current_cooldown_until == false or tonumber(current_cooldown_until) <= now_ms then
  redis.call('DEL', cooldown_key)
end

local newest = redis.call('ZREVRANGE', manual_resends_key, 0, 0, 'WITHSCORES')
if #newest == 2 then
  local manual_resends_ttl_ms = tonumber(newest[2]) + manual_window_ms - now_ms
  if manual_resends_ttl_ms > 0 then
    redis.call('PEXPIRE', manual_resends_key, manual_resends_ttl_ms)
  else
    redis.call('DEL', manual_resends_key)
  end
end

local should_update_last_send = true
local current_last_send = redis.call('GET', last_send_key)
if current_last_send ~= false then
  local decoded_ok, decoded = pcall(cjson.decode, current_last_send)
  if not decoded_ok or type(decoded) ~= 'table' or tonumber(decoded.logicalSendAtMs) == nil then
    return { 9 }
  end
  should_update_last_send = logical_send_at_ms >= tonumber(decoded.logicalSendAtMs)
end

if should_update_last_send then
  local last_send_ttl_ms = logical_send_at_ms + manual_window_ms - now_ms
  if last_send_ttl_ms > 0 then
    redis.call(
      'SET',
      last_send_key,
      cjson.encode({
        challengeId = challenge_id,
        origin = origin,
        logicalSendAtMs = logical_send_at_ms
      }),
      'PX',
      last_send_ttl_ms
    )
  end
end

if mutation_token ~= '' then
  local current_token = redis.call('GET', pending_key)
  if current_token == mutation_token then
    redis.call('DEL', pending_key)
  end
end

return { 0, manual_count, effective_cooldown_until_ms, math.max(0, cooldown_remaining_ms) }
`;

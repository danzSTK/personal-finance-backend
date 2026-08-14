export const LOAD_PASSWORD_CHANGE_STATE_SCRIPT = String.raw`
local failures_key = KEYS[1]
local block_key = KEYS[2]
local recurrence_key = KEYS[3]
local changes_key = KEYS[4]
local initialized_key = KEYS[5]
local pending_key = KEYS[6]

local now_ms = tonumber(ARGV[1])
local failure_window_ms = tonumber(ARGV[2])
local completed_window_ms = tonumber(ARGV[3])

local pending = redis.call('GET', pending_key)

if pending ~= false then
  return { 2, redis.call('PTTL', pending_key) }
end

local initialized = redis.call('GET', initialized_key)

if initialized == false then
  return { 0 }
end

redis.call(
  'ZREMRANGEBYSCORE',
  failures_key,
  '-inf',
  now_ms - failure_window_ms
)

redis.call(
  'ZREMRANGEBYSCORE',
  changes_key,
  '-inf',
  now_ms - completed_window_ms
)

local blocked_until = redis.call('GET', block_key)
local last_block_started_at = redis.call('GET', recurrence_key)
local failed_attempt_count = redis.call('ZCARD', failures_key)
local completed_changes = redis.call(
  'ZREVRANGE',
  changes_key,
  0,
  2,
  'WITHSCORES'
)

local response = {
  1,
  blocked_until or '',
  last_block_started_at or '',
  failed_attempt_count
}

for index = 2, #completed_changes, 2 do
  table.insert(response, completed_changes[index])
end

return response
`;

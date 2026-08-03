export const REPLACE_PASSWORD_CHANGE_STATE_SCRIPT = String.raw`
local failures_key = KEYS[1]
local block_key = KEYS[2]
local recurrence_key = KEYS[3]
local changes_key = KEYS[4]
local initialized_key = KEYS[5]
local pending_key = KEYS[6]

local payload = cjson.decode(ARGV[1])
local now_ms = tonumber(ARGV[2])
local failure_window_ms = tonumber(ARGV[3])
local completed_window_ms = tonumber(ARGV[4])
local recurrence_window_ms = tonumber(ARGV[5])
local initialized_ttl_ms = tonumber(ARGV[6])
local mutation_token = ARGV[7]

redis.call(
  'DEL',
  failures_key,
  block_key,
  recurrence_key,
  changes_key,
  initialized_key
)

local latest_failure_ms = nil

for _, entry in ipairs(payload.failedAttempts) do
  redis.call(
    'ZADD',
    failures_key,
    entry.occurredAtMs,
    entry.eventId
  )

  if latest_failure_ms == nil or entry.occurredAtMs > latest_failure_ms then
    latest_failure_ms = entry.occurredAtMs
  end
end

if latest_failure_ms ~= nil then
  local failure_ttl_ms =
    latest_failure_ms + failure_window_ms - now_ms

  if failure_ttl_ms > 0 then
    redis.call('PEXPIRE', failures_key, failure_ttl_ms)
  else
    redis.call('DEL', failures_key)
  end
end

if payload.blockedUntilMs ~= nil and payload.blockedUntilMs ~= cjson.null then
  local block_ttl_ms = payload.blockedUntilMs - now_ms

  if block_ttl_ms > 0 then
    redis.call(
      'SET',
      block_key,
      payload.blockedUntilMs,
      'PX',
      block_ttl_ms
    )
  end
end

if payload.lastBlockStartedAtMs ~= nil and payload.lastBlockStartedAtMs ~= cjson.null then
  local recurrence_ttl_ms =
    payload.lastBlockStartedAtMs + recurrence_window_ms - now_ms

  if recurrence_ttl_ms > 0 then
    redis.call(
      'SET',
      recurrence_key,
      payload.lastBlockStartedAtMs,
      'PX',
      recurrence_ttl_ms
    )
  end
end

local latest_change_ms = nil

for _, entry in ipairs(payload.completedChanges) do
  redis.call(
    'ZADD',
    changes_key,
    entry.occurredAtMs,
    entry.eventId
  )

  if latest_change_ms == nil or entry.occurredAtMs > latest_change_ms then
    latest_change_ms = entry.occurredAtMs
  end
end

if latest_change_ms ~= nil then
  local changes_ttl_ms =
    latest_change_ms + completed_window_ms - now_ms

  if changes_ttl_ms > 0 then
    redis.call('PEXPIRE', changes_key, changes_ttl_ms)
  else
    redis.call('DEL', changes_key)
  end
end

redis.call(
  'SET',
  initialized_key,
  '1',
  'PX',
  initialized_ttl_ms
)

if mutation_token ~= '' then
  local current_token = redis.call('GET', pending_key)

  if current_token == mutation_token then
    redis.call('DEL', pending_key)
  end
end

return 1
`;

export const BEGIN_PASSWORD_CHANGE_MUTATION_SCRIPT = String.raw`
local acquired = redis.call(
  'SET',
  KEYS[2],
  ARGV[1],
  'NX',
  'PX',
  ARGV[2]
)

if acquired == false then
  return { 0, redis.call('PTTL', KEYS[2]) }
end

redis.call('DEL', KEYS[1])
return { 1, tonumber(ARGV[2]) }
`;

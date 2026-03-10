-- webhook.lua
-- Orthanc OnStableStudy Lua callback
--
-- Fires an HTTP POST to the backend API whenever a study becomes stable
-- (i.e., all instances have been received and the StableAge timer expires).
-- The backend then queries Orthanc's REST API for full DICOM metadata and
-- syncs the study into the pacs_platform PostgreSQL database.

function OnStableStudy(studyId, tags, metadata)
  local body = '{"orthancStudyId":"' .. studyId .. '"}'

  local headers = {}
  headers['content-type'] = 'application/json'

  local ok, answer = pcall(
    HttpPost,
    'http://backend:3001/api/studies/webhook',
    body,
    headers
  )

  if ok then
    print('[Webhook] Backend notified for stable study: ' .. studyId)
  else
    print('[Webhook] Failed to notify backend for study: ' .. studyId ..
          ' - Error: ' .. tostring(answer))
  end
end

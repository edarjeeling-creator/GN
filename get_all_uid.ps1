$headers = @{
    "apikey" = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o"
}
$response = Invoke-RestMethod -Uri "https://supabase.gyanodayniketan.cloud/rest/v1/profiles?select=name,role,uid" -Method Get -Headers $headers
$response | ConvertTo-Json

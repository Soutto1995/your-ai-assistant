SELECT cron.schedule(
  'daily-reminders',
  '0 11 * * *',
  $$
  SELECT net.http_post(
      url:='https://jwxrtnleqdvzvoywzqir.supabase.co/functions/v1/send-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3eHJ0bmxlcWR2enZveXd6cWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2Njk3NjQsImV4cCI6MjA4ODI0NTc2NH0.qK6EVaY11CiYW30hn-Yv8cy2VQ_gYfub_Q1ghrZ8Ocw"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;
  $$
);
-- 由 concert*.js 自动生成的 INSERT SQL
-- 生成时间 · generated: 2026-08-27T16:36:26.267Z
-- 建议先保证表结构已存在（schema.sql / 已有库）
-- 若需清空旧数据再插入，请先执行：
--   DELETE FROM concert_songlist; DELETE FROM concert_images; DELETE FROM concert_tags; DELETE FROM concerts;

-- ============================================
-- id:1 五月天 Just Rock It 2016
-- ============================================
INSERT INTO concerts (id, artist_zh, artist_en, concert_name_zh, concert_name_en, theme_zh, theme_en, country_zh, country_en, province_zh, province_en, city_zh, city_en, venue_zh, venue_en, seat_zh, seat_en, price_zh, price_en, date, time, poster, description_zh, description_en, video_zh, video_en, video_url_zh, video_url_en)
VALUES (1, '五月天', 'Mayday', 'Just Rock It 2016', 'Just Rock It 2016', '演唱会以"生老病死就是一场人生派对"为主题，鼓励观众正面迎战。2016年巡演以高成本打造炫目舞台，并融入当时新专辑《自传》的概念，是一场充满能量、情怀与万人集体狂欢的摇滚派对。', 'The concert uses ''birth, aging, sickness, and death are a life party'' as its theme, encouraging the audience to face challenges head-on. The 2016 tour created a dazzling stage at high cost and incorporated concepts from the then-new album ''Autobiography,'' making it a rock party full of energy, sentiment, and collective celebration for thousands of people.', '中国', 'China', '陕西', 'Shaanxi', '西安', 'Xi''an', '陕西省体育场', 'Shaanxi Provincial Stadium', '25-26 22排', 'Row 22,Stands 25-26', '¥455', '¥455', '2016.09.03', '19:30', 'concert/poster/20160903.jpg', '看着旁边拿着望远镜的小兄弟，      <br/>『请问，你是铁粉？』    <br/>「大哥，我是假粉，我女朋友是铁粉」       <br/>『ohh~~~，那我也是假粉。我不会唱几首呢』       <br/>「大哥，我同样也不会」       <br/>『ohh~~~』     <br/>结果，   <br/>从第一首唱到最后一首，<br/>我扛着单反录了一晚上演唱会，全是旁边小哥的歌声， <br/>他女朋友也录了一晚上，相机对着她旁边的男朋友， <br/>果然都是假粉，  <br/><br/>一直以来觉得自己，  <br/>不是一名合适的五迷， <br/>不象周围可爱的人从第一首跟唱到最后一首， <br/>只是静静的坐着听着，   <br/>十万人合唱的恋爱ing， <br/>举起手机当荧光棒的温柔， <br/>跟着安可安可最后一首歌，  <br/><br/>那别人触不可及的盛夏里，  <br/>风吹雨落，岁月沧桑刻下，  <br/>请好好的，<br/>我们自己就是观众，，，<br/>请不打扰， <br/>那些爱人温柔，，，', 'Looking at the little brother next to me holding binoculars,      <br/>『Excuse me, are you a hardcore fan?』    <br/>「Bro, I''m a fake fan, my girlfriend is the hardcore one」       <br/>『ohh~~~, then I''m a fake fan too. I don''t know many songs』       <br/>「Bro, I don''t either」       <br/>『ohh~~~』     <br/>In the end,   <br/>From the first song to the last,<br/>I held up a DSLR recording the entire concert, full of the guy''s singing next to me, <br/>His girlfriend also recorded all night, her camera pointed at her boyfriend beside her, <br/>All fake fans indeed,  <br/><br/>I''ve always felt,  <br/>I''m not a proper Wumii (Mayday fan), <br/>Unlike the lovely people around me singing along from the first to the last song, <br/>I just sat quietly listening,   <br/>The hundred-thousand-person chorus of 『Love-ing』, <br/>Raising phones as glow sticks for 『Tenderness』, <br/>Following the encore, encore, the final song,  <br/><br/>In that summer beyond others'' reach,  <br/>Wind blows, rain falls, Under the vicissitudes of time,  <br/>Please be well,<br/>We ourselves are the audience,,,<br/>Please don''t disturb, <br/>Those gentle lovers,,,', NULL, NULL, NULL, NULL);
INSERT INTO concert_tags (concert_id, zh, en) VALUES (1, '五月天', 'Fans');
INSERT INTO concert_tags (concert_id, zh, en) VALUES (1, '单反', 'DSLR');
INSERT INTO concert_tags (concert_id, zh, en) VALUES (1, '恋爱ing', 'Mayday');
INSERT INTO concert_tags (concert_id, zh, en) VALUES (1, '安可', 'Love-ing');
INSERT INTO concert_images (concert_id, src, alt_zh, alt_en) VALUES (1, 'concert/20160903/01.jpg', '五月天演唱会', 'Mayday Concert');
INSERT INTO concert_images (concert_id, src, alt_zh, alt_en) VALUES (1, 'concert/20160903/02.jpg', '五月天演唱会', 'Mayday Concert');
INSERT INTO concert_songlist (concert_id, seq, zh, en, link) VALUES (1, 1, 'Do You Ever Shine', 'Do You Ever Shine', NULL);
INSERT INTO concert_songlist (concert_id, seq, zh, en, link) VALUES (1, 2, '三个傻瓜', 'Three Fools', NULL);
INSERT INTO concert_songlist (concert_id, seq, zh, en, link) VALUES (1, 3, '你不是真正的快乐', 'You Are Not Truly Happy', NULL);
INSERT INTO concert_songlist (concert_id, seq, zh, en, link) VALUES (1, 4, '为爱而生', 'Born For Love', NULL);

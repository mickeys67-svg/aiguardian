-- 부록 B 1차 레시피 후보 시드 (3개로 시작, 나머지는 점진적 추가).
INSERT OR REPLACE INTO recipes
    (id, title, category, difficulty, est_minutes, description, outcome, requires, prompt_template, steps, featured)
VALUES
    (
        '01-simple-webpage',
        '간단 웹페이지',
        'web',
        '입문',
        15,
        '내 이름 + 사진 + 자기소개 페이지를 만들고 인터넷에 띄웁니다.',
        '친구한테 카톡으로 바로 공유 가능한 진짜 인터넷 주소를 받습니다.',
        '["node","git"]',
        '내 이름은 {{name}} 입니다. 자기소개 한 페이지를 만들어주세요. HTML 파일 하나로, 사진 자리는 <img placeholder>로 두고, 색상은 청록색(#4ECDC4) 톤으로 부드럽게.',
        '[]',
        1
    ),
    (
        '02-discord-bot',
        '디스코드 알림 봇',
        'bot',
        '입문+',
        40,
        '특정 시간에 자동으로 메시지를 보내는 디스코드 봇.',
        '친구들 게임 시간을 자동으로 알려주는 봇이 24시간 굴러갑니다.',
        '["node","git"]',
        '디스코드 봇을 만들어주세요. discord.js 14 사용. 매일 저녁 8시에 #general 채널에 "오늘도 게임 시간!" 메시지를 자동 발송. 봇 토큰은 환경변수 DISCORD_TOKEN 으로 받음.',
        '[]',
        0
    ),
    (
        '06-photo-resize',
        '사진 일괄 리사이즈',
        'automation',
        '입문+',
        30,
        '폴더 안 사진을 한 번에 원하는 크기로 줄입니다.',
        'GB 단위 사진 폴더가 5분 만에 메일·블로그 올리기 좋은 크기로 정리됩니다.',
        '["python3"]',
        'Python 스크립트를 만들어주세요. 입력 폴더의 모든 jpg/png 사진을 가로 1024px (비율 유지) 로 리사이즈해서 출력 폴더에 저장. Pillow 라이브러리 사용. 진행 상황을 한국어로 출력.',
        '[]',
        0
    );

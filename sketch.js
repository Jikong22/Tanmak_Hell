let player;
let bullets = [];
let items = [];
let playerSpeed = 3;
let playerRadius = 10;

let health = 3;
let maxHealth = 5;
let invincible = false;
let invincibilityTimer = 0;

let patternTimer = 0;
let currentPattern = 0;
let startTime;
let difficultyMultiplier = 1;

// 일반 패턴 중복 방지용
let lastGeneralPattern = -1;

// 지속 포화 패턴용 변수
let isBarrageActive = false;
let barrageEndTime = 0;
let barrageSpawnPoint;
let barrageBaseAngle = 0;
let barrageMoveDirection;
let barrageMoveSpeed = 2;

// 게임 상태: 'start', 'playing', 'gameOver', 'scoreboard', 'rules'
let gameState = 'start';
let lastScreen = 'start'; // 스코어보드에서 돌아갈 화면을 기억
let playerName = '';
let nameInput;
let gameCanvas;
let finalSurvivalTime = 0;

//게임 사운드 관련
let lobbyBGM, gameBGM, hitSFX;

// 게임 사운드 음량 조절
let lobbySlider, gameSlider, sfxSlider;
let lobbyLabel, gameLabel, sfxLabel;

function preload() {
  lobbyBGM = loadSound('assets/lobby_bgm.mp3');
  gameBGM = loadSound('assets/game_bgm.mp3');
  hitSFX = loadSound('assets/hit_sound.mp3');
}

function setup() {
  gameCanvas = createCanvas(1500, 650);
  player = createVector(width / 2, height - 50);
  frameRate(60);
  nameInput = createInput('').attribute('placeholder', '이름을 입력하세요');
  nameInput.hide();

  // 로비 슬라이더와 라벨
  lobbyLabel = createDiv("로비 BGM");
  lobbyLabel.position(20, 20);
  lobbySlider = createSlider(0, 1, 0.5, 0.01);
  lobbySlider.position(100, 20);
  lobbySlider.style('width', '150px');

  // 게임 슬라이더와 라벨
  gameLabel = createDiv("게임 BGM");
  gameLabel.position(20, 50);
  gameSlider = createSlider(0, 1, 0.5, 0.01);
  gameSlider.position(100, 50);
  gameSlider.style('width', '150px');

  // 효과음 슬라이더와 라벨
  sfxLabel = createDiv("효과음");
  sfxLabel.position(20, 80);
  sfxSlider = createSlider(0, 1, 1.0, 0.01);
  sfxSlider.position(100, 80);
  sfxSlider.style('width', '150px');
}

function draw() {
  background(0);

// 실시간 볼륨 적용
lobbyBGM.setVolume(lobbySlider.value());
gameBGM.setVolume(gameSlider.value());
hitSFX.setVolume(sfxSlider.value());

   if (gameState === 'playing') {
    if (!gameBGM.isPlaying()) {
      lobbyBGM.stop();
      gameBGM.loop();
    }
  } else {
    if (!lobbyBGM.isPlaying()) {
      gameBGM.stop();
      lobbyBGM.loop();
    }
  }

  if (gameState === 'start') {
    drawStartScreen();
    return;
  }

  if (gameState === 'scoreboard') {
    drawScoreboardScreen();
    return;
  }

  if (gameState === 'rules') {
    drawRulesScreen();
    return;
  }

  // 게임 오버 화면은 게임 화면 위에 겹쳐서 그림
  if (gameState === 'gameOver') {
    // 마지막 게임 상태를 그리고
    drawPlayer();
    drawBullets();
    drawItems();
    drawUI();
    // 그 위에 오버레이를 씌움
    drawGameOverScreen();
    return;
  }

  // 게임 중에는 기본 커서 사용
  cursor('default');

  // 무적 시간 처리
  if (invincible) {
    invincibilityTimer--;
    if (invincibilityTimer <= 0) {
      invincible = false;
    }
  }

  handleMovement();
  drawPlayer();

  updateBullets();
  drawBullets();
  checkCollisions();

  updateItems();
  drawItems();
  checkItemCollisions();

  drawUI();

  let survivalTime = (millis() - startTime) / 1000;
  difficultyMultiplier = 1 + survivalTime / 45;

  // 지속 포화 패턴이 활성화되어 있으면 해당 로직 실행
  if (isBarrageActive) {
    handleBarragePattern();
  } else {
    // 일반 패턴 생성
    patternTimer++;
    if (patternTimer > max(60, 240 / difficultyMultiplier)) {
      let newPattern;
      do {
        newPattern = floor(random(5)); // 웨이브 패턴 추가 후 총 5개
      } while (newPattern === lastGeneralPattern);
      lastGeneralPattern = newPattern;
      spawnPattern(newPattern);
      patternTimer = 0;
    }
  }
}

// 5초 지속 포화 패턴 처리
function handleBarragePattern() {
  if (millis() > barrageEndTime) {
    isBarrageActive = false;
    return;
  }

  // 발사 지점 이동
  if (barrageMoveDirection) {
    barrageSpawnPoint.add(barrageMoveDirection.copy().mult(barrageMoveSpeed));

    // 화면 가장자리(20% 여백)에 닿으면 방향 전환
    if (barrageMoveDirection.y === 0) { // 좌우 이동
      if (barrageSpawnPoint.x <= width * 0.2 || barrageSpawnPoint.x >= width * 0.8) {
        barrageMoveDirection.x *= -1;
      }
    } else { // 상하 이동
      if (barrageSpawnPoint.y <= height * 0.2 || barrageSpawnPoint.y >= height * 0.8) {
        barrageMoveDirection.y *= -1;
      }
    }
  }

  // 프레임당 평균 1.2발 (기존 2발에서 40% 감소)을 발사합니다.
  // 2번의 발사 기회에서 각각 60% 확률로 발사합니다.
  for (let i = 0; i < 2; i++) {
    if (random() < 0.4) { // 40% 확률로 발사
      // 발사 각도를 40도로 줄임 (PI/9 라디안 = 20도)
      let angle = barrageBaseAngle + random(-PI / 9, PI / 9);
      let speed = (random(3.5, 5) + difficultyMultiplier * 0.2) * 0.8;
      bullets.push(
        { x: barrageSpawnPoint.x, y: barrageSpawnPoint.y, dir: angle, speed: speed }
      );
    }
  }
}

// 플레이어 이동 처리
function handleMovement() {
  let velocity = createVector(0, 0);
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) velocity.x -= 1;
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) velocity.x += 1;
  if (keyIsDown(87) || keyIsDown(UP_ARROW)) velocity.y -= 1;
  if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) velocity.y += 1;

  if (velocity.mag() > 0) {
    velocity.setMag(playerSpeed);
    player.add(velocity);
    player.x = constrain(player.x, playerRadius, width - playerRadius);
    player.y = constrain(player.y, playerRadius, height - playerRadius);
  }
}

// 플레이어 그리기
function drawPlayer() {
  fill(invincible ? 'blue' : 'lime');
  ellipse(player.x, player.y, playerRadius * 2);
}

// 총알 위치 업데이트
function updateBullets() {
  // 배열을 역순으로 순회하여 안전하게 요소 제거 (성능 개선)
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];

    // 총알 타입에 따른 움직임 처리
    if (b.type === 'wave') {
      b.angle += b.frequency;
      // startX를 기준으로 좌우로 흔들리며 아래로 이동
      b.x = b.startX + sin(b.angle) * b.amplitude;
      b.y += b.speed;
    } else {
      // 기본 직선 이동
      b.x += cos(b.dir) * b.speed;
      b.y += sin(b.dir) * b.speed;
    }

    // 화면 밖으로 나간 총알 제거
    if (b.x < -20 || b.x > width + 20 || b.y < -20 || b.y > height + 20) {
      bullets.splice(i, 1);
    }
  }
}

// 총알 그리기
function drawBullets() {
  noStroke();
  fill(255, 0, 0); // 모든 총알을 빨간색으로 고정
  for (let b of bullets) {
    if (b.type === 'wave') {
      ellipse(b.x, b.y, 12, 12);
    } else {
      ellipse(b.x, b.y, 10);
    }
  }
}

// 플레이어와 총알 충돌 체크
function checkCollisions() {
  if (invincible) return;
  for (let b of bullets) {
    let bulletRadius = 5; // 기본 총알 반지름
    if (b.type === 'wave') bulletRadius = 6;
    if (dist(b.x, b.y, player.x, player.y) < playerRadius + bulletRadius) {
      hitSFX.play(); // 피격 효과음 재생
      health--;
      invincible = true;
      invincibilityTimer = 120;
      if (health <= 0) {
        gameState = 'gameOver';
        finalSurvivalTime = parseFloat(((millis() - startTime) / 1000).toFixed(1));
        saveScore(playerName, finalSurvivalTime);
      }
      break;
    }
  }
}

// UI 그리기 (체력, 시간)
function drawUI() {
  fill(255);

  // 체력을 하트 이모티콘으로 표시
  let hearts = '';
  for (let i = 0; i < maxHealth; i++) {
    if (i < health) {
      hearts += '❤️'; // 현재 체력
    } else {
      hearts += '🤍'; // 잃은 체력
    }
  }
  textSize(24); // 이모티콘 크기
  text(hearts, 10, 30);

  // 생존 시간 표시
  textSize(20); // 생존 시간 텍스트 크기
  let t = gameState === 'playing' ? ((millis() - startTime) / 1000).toFixed(1) : '0.0';
  text(`${playerName}님의 생존 시간: ${t}초`, 10, 60);
}

// 일반 탄막 패턴 생성
function spawnPattern(index) {
  switch (index) {
    case 0: // 부채꼴 패턴 (Fan)
      {
        let count = floor(15 + 10 * difficultyMultiplier);
        let speed = (3 + difficultyMultiplier * 0.5) * 0.8;
        let fanAngle = PI * 0.8; // 144도 부채꼴로 확장
        let spawnX = random(width * 0.2, width * 0.8); // 화면 상단 중앙 부근에서 생성
        let spawnY = -10;
        let baseAngle = HALF_PI; // 아래 방향
        let startAngle = baseAngle - fanAngle / 2;

        for (let i = 0; i < count; i++) {
          // 부채꼴 모양으로 각도를 계산
          let angle = startAngle + (fanAngle / (count - 1)) * i;
          bullets.push({ x: spawnX, y: spawnY, dir: angle, speed: speed });
        }
      }
      break;
    case 1: // 기관총 (Machine Gun)
      {
        let burstCount = floor(10 + 12 * difficultyMultiplier);
        let baseSpeed = 4.5 + difficultyMultiplier * 0.5;
        let spread = 0.5; // 탄 퍼짐 정도 (라디안) 

        let side = floor(random(3)); // 0: 위, 1: 왼쪽, 2: 오른쪽
        let spawnPoint = createVector(0, 0);
        let baseAngle = 0;

        if (side === 0) { spawnPoint.set(random(width), -10); baseAngle = HALF_PI; }
        else if (side === 1) { spawnPoint.set(-10, random(height)); baseAngle = 0; }
        else { spawnPoint.set(width + 10, random(height)); baseAngle = PI; }

        for (let i = 0; i < burstCount; i++) {
          let angle = baseAngle + random(-spread / 2, spread / 2);
          let finalSpeed = (baseSpeed + random(-0.5, 0.5)) * 0.8; // 약간의 속도 변화를 주어 '두두두' 느낌을 살림
          bullets.push({ x: spawnPoint.x, y: spawnPoint.y, dir: angle, speed: finalSpeed });
        }
      }
      break;
    case 2: // 비 내리기 (Rain)
      {
        let count = floor(20 + 30 * difficultyMultiplier);
        for (let i = 0; i < count; i++) {
          bullets.push({ x: random(width), y: -10, dir: HALF_PI, speed: random(2, 4) * 0.8 });
        }
      }
      break;
    case 3: // 5초 지속 포화 (Sustained Barrage)
      {
        isBarrageActive = true;
        barrageEndTime = millis() + 5000; // 5초간 지속
        barrageMoveSpeed = 2 + difficultyMultiplier * 0.5;

        let side = floor(random(2)); // 0:위, 1:아래 (옆에서는 더 이상 나오지 않음)
        switch (side) {
          case 0: // 위
            barrageSpawnPoint = createVector(width * 0.2, -10);
            barrageBaseAngle = HALF_PI;
            barrageMoveDirection = createVector(1, 0);
            break;
          case 1: // 아래
            barrageSpawnPoint = createVector(width * 0.8, height + 10);
            barrageBaseAngle = -HALF_PI;
            barrageMoveDirection = createVector(-1, 0);
            break;
          case 2: // 왼쪽
            barrageSpawnPoint = createVector(-10, height * 0.2);
            barrageBaseAngle = 0;
            barrageMoveDirection = createVector(0, 1);
            break;
          case 3: // 오른쪽
            barrageSpawnPoint = createVector(width + 10, height * 0.8);
            barrageBaseAngle = PI;
            barrageMoveDirection = createVector(0, -1);
            break;
        }
      }
      break;
    case 4: // 웨이브 (Wave)
      {
        let streams = 10 + floor(difficultyMultiplier * 5); // 평행 웨이브 줄기 수
        let amplitude = 20 + random(20); // 웨이브의 폭
        let frequency = 0.05 + random(0.02); // 웨이브의 촘촘함
        let speed = (2.5 + difficultyMultiplier * 0.3) * 0.8;

        for (let i = 0; i < streams; i++) {
          let startX = (width / streams) * (i + 0.5);
          bullets.push({
            x: startX,
            y: -10,
            startX: startX,
            speed: speed,
            type: 'wave',
            amplitude: amplitude,
            frequency: frequency,
            // 시각적으로 더 보기 좋게 웨이브 시작점을 엇갈리게 함
            angle: i * 0.5
          });
        }
      }
      break;
  }
}

// 점수 저장
function saveScore(name, score) {
  let scores = JSON.parse(localStorage.getItem('tanmakScores')) || [];

  // 같은 이름이 이미 있을 경우, 뒤에 (1), (2) 등을 붙여 구분
  let finalName = name;
  if (scores.some(s => s.name === name)) {
    let counter = 1;
    while (scores.some(s => s.name === `${name}(${counter})`)) {
      counter++;
    }
    finalName = `${name} (${counter})`;
  }

  scores.push({ name: finalName, score });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 10); // 상위 10개 기록만 저장
  localStorage.setItem('tanmakScores', JSON.stringify(scores));
}

// 아이템 업데이트
function updateItems() {
  // 회복 아이템 등장 확률을 낮춤 (0.5% -> 0.13%)
  if (random() < 0.0013) {
    items.push({ x: random(50, width - 50), y: -10, speed: 2, type: "heal" });
  }
  for (let i of items) {
    i.y += i.speed;
  }
  items = items.filter(i => i.y < height + 10);
}

// 아이템 그리기
function drawItems() {
  for (let i of items) {
    if (i.type === "heal") fill(0, 255, 255);
    ellipse(i.x, i.y, 15);
  }
}

// 아이템 충돌 체크
function checkItemCollisions() {
  for (let i = items.length - 1; i >= 0; i--) {
    if (dist(items[i].x, items[i].y, player.x, player.y) < 15) {
      if (items[i].type === "heal" && health < maxHealth) health++;
      items.splice(i, 1);
    }
  }
}

function drawStartScreen() {
  // "탄막지옥" 타이틀
  fill(255, 0, 0);
  textAlign(CENTER, CENTER);
  textSize(100);
  text("탄막지옥", width / 2, height / 2 - 150);

  // HTML 이름 입력창 표시 및 위치 설정
  nameInput.show();
  let inputW = 400;
  let inputH = 60;
  let inputX = width / 2 - inputW / 2; // 중앙 정렬
  let inputY = height / 2 - 70; // 버튼 그룹과 함께 전체적으로 위로 이동
  let canvasPos = gameCanvas.elt.getBoundingClientRect();
  nameInput.position(canvasPos.left + inputX, canvasPos.top + inputY);
  nameInput.size(inputW, inputH);
  nameInput.style('font-size', '24px').style('text-align', 'center').style('border-radius', '15px').style('border', '2px solid #ccc');

  // 게임 시작 버튼 영역
  let buttonX = width / 2 - 125;
  let buttonW = 250;
  let buttonH = 50;
  let buttonY = inputY + inputH + 10; // 입력창 바로 아래에 위치

  // 마우스가 버튼 위에 있을 때 효과
  if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
    fill(120, 0, 0);
    cursor('pointer');
  } else {
    fill(80, 0, 0);
    cursor('default');
  }
  stroke(255, 0, 0);
  rect(buttonX, buttonY, buttonW, buttonH, 15);

  // 버튼 텍스트
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(28);
  text("게임 시작", buttonX + buttonW / 2, buttonY + buttonH / 2);

  // 스코어보드 버튼
  let sbButtonY = buttonY + buttonH + 10;

  if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > sbButtonY && mouseY < sbButtonY + buttonH) { // 스코어보드 버튼
    fill(50, 50, 0);
    cursor('pointer');
  } else {
    fill(30, 30, 0);
  }
  stroke(255, 255, 0);
  rect(buttonX, sbButtonY, buttonW, buttonH, 15);

  // 버튼 텍스트
  noStroke();
  fill(255);
  text("스코어보드", width / 2, sbButtonY + buttonH / 2);

  // 게임 룰 버튼
  let rulesButtonY = sbButtonY + buttonH + 10;
  if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > rulesButtonY && mouseY < rulesButtonY + buttonH) {
    fill(0, 50, 50);
    cursor('pointer');
  } else {
    fill(0, 30, 30);
  }
  stroke(0, 255, 255);
  rect(buttonX, rulesButtonY, buttonW, buttonH, 15);

  // 버튼 텍스트
  noStroke();
  fill(255);
  text("게임 방법", width / 2, rulesButtonY + buttonH / 2);

  textAlign(LEFT, BASELINE);
}

function drawGameOverScreen() {
  // 반투명 배경으로 게임 화면을 어둡게 처리
  cursor('default');
  background(0, 150);

  // "Game Over" 텍스트
  fill(255, 0, 0);
  textAlign(CENTER, CENTER);
  textSize(64);
  text("Game Over", width / 2, height / 2 - 80);

  // 최종 생존 시간 표시
  fill(255);
  textSize(24);
  text(`${playerName}님의 생존 시간: ${finalSurvivalTime}초`, width / 2, height / 2 - 20);

  // 다시하기 버튼 영역
  let buttonW = 180; // 버튼 너비
  let buttonH = 50;
  let gap = 20;
  let totalW = buttonW * 3 + gap * 2;
  let startX = width / 2 - totalW / 2;

  let restartButtonX = startX;
  let buttonY = height / 2 + 40;

  // 마우스가 버튼 위에 있을 때 효과 (색상 변경 및 커서 변경)
  if (mouseX > restartButtonX && mouseX < restartButtonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
    fill(100);
    cursor('pointer');
  } else {
    fill(50);
  }
  stroke(255);
  rect(restartButtonX, buttonY, buttonW, buttonH, 10);

  // 버튼 텍스트
  noStroke();
  fill(255);
  textSize(28);
  text("다시하기", restartButtonX + buttonW / 2, buttonY + buttonH / 2);

  // 스코어보드 버튼
  let sbButtonX = startX + buttonW + gap;
  if (mouseX > sbButtonX && mouseX < sbButtonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
    fill(100, 100, 0);
    cursor('pointer');
  } else {
    fill(50, 50, 0);
  }
  stroke(255, 255, 0);
  rect(sbButtonX, buttonY, buttonW, buttonH, 10);

  // 버튼 텍스트
  noStroke();
  fill(255);
  text("스코어보드", sbButtonX + buttonW / 2, buttonY + buttonH / 2);

  // 처음화면 버튼
  let homeButtonX = startX + (buttonW + gap) * 2;
  if (mouseX > homeButtonX && mouseX < homeButtonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
    fill(0, 100, 100);
    cursor('pointer');
  } else {
    fill(0, 50, 50);
  }
  stroke(0, 255, 255);
  rect(homeButtonX, buttonY, buttonW, buttonH, 10);

  // 버튼 텍스트
  noStroke();
  fill(255);
  text("처음화면", homeButtonX + buttonW / 2, buttonY + buttonH / 2);

  // 텍스트 정렬 초기화
  textAlign(LEFT, BASELINE);
}

function drawScoreboardScreen() {
  background(10, 0, 20); // 어두운 보라색 배경
  nameInput.hide();
  cursor('default');

  // 타이틀
  fill(255, 255, 0);
  textAlign(CENTER, CENTER);
  textSize(56); // 타이틀 크기 조정
  text("스코어보드", width / 2, 80);

  // 점수 목록
  let scores = JSON.parse(localStorage.getItem('tanmakScores')) || [];
  textSize(24);
  fill(255);
  if (scores.length === 0) {
    textAlign(CENTER);
    text("아직 기록이 없습니다.", width / 2, height / 2);
  } else {
    // 10등까지만 표시하고, 버튼과 겹치지 않도록 간격 조정
    for (let i = 0; i < scores.length; i++) {
      let rank = i + 1;
      let name = scores[i].name;
      let score = scores[i].score.toFixed(1);
      let yPos = 150 + i * 35; // 시작 위치와 간격 조정
      let rankEmoji = '';
      let rankText = `${rank}등`;

      if (rank === 1) {
        rankEmoji = '🥇';
      } else if (rank === 2) {
        rankEmoji = '🥈';
      } else if (rank === 3) {
        rankEmoji = '🥉';
      }

      // 1등은 특별하게 표시
      if (rank === 1) {
        fill(255, 215, 0); // 금색
        textSize(26);
      } else {
        fill(255);
        textSize(24);
      }

      // 각 정보 열의 X 좌표 정의
      let emojiX = width / 2 - 230;
      let rankTextX = width / 2 - 180;
      let nameX = width / 2 - 160;

      // 이모티콘, 등수, 이름, 점수를 각각 정렬하여 그리기
      textAlign(CENTER);
      text(rankEmoji, emojiX, yPos);
      textAlign(RIGHT);
      text(rankText, rankTextX, yPos);
      textAlign(LEFT);
      text(name, nameX, yPos);
      textAlign(RIGHT);
      text(`${score}초`, width / 2 + 200, yPos);
    }
    // 루프 후 텍스트 스타일 초기화
    textSize(24);
    fill(255);
    textAlign(LEFT);
  }

  // 돌아가기 버튼
  let buttonX = width / 2 - 100;
  let buttonY = height - 100;
  let buttonW = 200;
  let buttonH = 50;

  if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
    fill(100);
    cursor('pointer');
  } else {
    fill(50);
  }
  stroke(255);
  rect(buttonX, buttonY, buttonW, buttonH, 10);
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(28);
  text("돌아가기", width / 2, buttonY + buttonH / 2);
  textAlign(LEFT, BASELINE);

  // 초기화 버튼
  let resetButtonX = width - 180;
  let resetButtonY = height - 100;
  let resetButtonW = 150;
  let resetButtonH = 50;

  if (mouseX > resetButtonX && mouseX < resetButtonX + resetButtonW && mouseY > resetButtonY && mouseY < resetButtonY + resetButtonH) {
    fill(150, 0, 0);
    cursor('pointer');
  } else {
    fill(80, 0, 0);
  }
  stroke(255, 100, 100);
  rect(resetButtonX, resetButtonY, resetButtonW, resetButtonH, 10);
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(28);
  text("초기화", resetButtonX + resetButtonW / 2, resetButtonY + resetButtonH / 2);
  textAlign(LEFT, BASELINE);
}

function drawRulesScreen() {
  background(0, 10, 20); // 어두운 파란색 배경
  nameInput.hide();
  cursor('default');

  // 타이틀
  fill(0, 255, 255);
  textAlign(CENTER, CENTER);
  textSize(64);
  text("게임 방법", width / 2, 80);

  // 설명 텍스트
  fill(255);
  textAlign(LEFT);
  textSize(24);
  let textX = width / 2 - 250;
  let textY = 180;
  text("■ 목표", textX, textY);
  text("   - 쏟아지는 총알을 피해 100초 동안 생존하여 상품을 얻으세요.", textX, textY + 40);
  text("■ 조작", textX, textY + 100);
  text("   - 이동: WASD 또는 방향키 (←↑→↓)", textX, textY + 140);
  text("■ 아이템", textX, textY + 200);
  text("   - 💙 (청록색 원): 체력을 1 회복합니다.", textX, textY + 240);

  // 돌아가기 버튼
  let buttonX = width / 2 - 100;
  let buttonY = height - 100;
  let buttonW = 200;
  let buttonH = 50;

  if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
    fill(100);
    cursor('pointer');
  } else {
    fill(50);
  }
  stroke(255);
  rect(buttonX, buttonY, buttonW, buttonH, 10);
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(28);
  text("돌아가기", width / 2, buttonY + buttonH / 2);
  textAlign(LEFT, BASELINE);
}

function startGame() {
  playerName = nameInput.value();
  if (playerName.trim() === '') {
    playerName = 'Player'; // 이름이 비어있으면 기본값 설정
  }
  nameInput.hide();
  restartGame();
  gameState = 'playing';
}

function restartGame() {
  health = 3;
  invincible = false;
  invincibilityTimer = 0;
  bullets = [];
  items = [];
  player.set(width / 2, height - 50);
  startTime = millis();
  patternTimer = 0;
  difficultyMultiplier = 1;
  lastGeneralPattern = -1;
  isBarrageActive = false;
  barrageEndTime = 0;
  barrageMoveDirection = undefined;
}

function mousePressed() {
  if (gameState === 'gameOver') {
    let buttonW = 180;
    let gap = 20;
    let totalW = buttonW * 3 + gap * 2;
    let startX = width / 2 - totalW / 2;
    let buttonY = height / 2 + 40;
    let buttonH = 50;

    let restartButtonX = startX;
    if (mouseX > restartButtonX && mouseX < restartButtonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
      restartGame();
      gameState = 'playing';
    }

    let sbButtonX = startX + buttonW + gap;
    if (mouseX > sbButtonX && mouseX < sbButtonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
      lastScreen = 'gameOver';
      gameState = 'scoreboard';
    }

    let homeButtonX = startX + (buttonW + gap) * 2;
    if (mouseX > homeButtonX && mouseX < homeButtonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
      gameState = 'start';
    }
  } else if (gameState === 'start') {
    // 버튼 위치 계산 (drawStartScreen과 동일하게)
    let buttonW = 250;
    let buttonH = 50;
    let buttonX = width / 2 - 125;

    let inputH = 60;
    let inputY = height / 2 - 70;
    let buttonY = inputY + inputH + 10; // 게임 시작 버튼 Y

    // 게임 시작 버튼 클릭 확인
    if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
      startGame();
    }

    // 스코어보드 버튼 클릭 확인
    let sbButtonY = buttonY + buttonH + 10; // 스코어보드 버튼 Y
    if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > sbButtonY && mouseY < sbButtonY + buttonH) {
      lastScreen = 'start';
      nameInput.hide();
      gameState = 'scoreboard';
    }

    // 게임 룰 버튼 클릭 확인
    let rulesButtonY = sbButtonY + buttonH + 10;
    if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > rulesButtonY && mouseY < rulesButtonY + buttonH) {
      lastScreen = 'start';
      nameInput.hide();
      gameState = 'rules';
    }
  } else if (gameState === 'scoreboard') {
    let buttonX = width / 2 - 100;
    let buttonY = height - 100;
    if (mouseX > buttonX && mouseX < buttonX + 200 && mouseY > buttonY && mouseY < buttonY + 50) {
      gameState = lastScreen;
    }

    // 초기화 버튼 클릭 처리
    let resetButtonX = width - 180;
    let resetButtonY = height - 100;
    let resetButtonW = 150;
    let resetButtonH = 50;
    if (mouseX > resetButtonX && mouseX < resetButtonX + resetButtonW && mouseY > resetButtonY && mouseY < resetButtonY + resetButtonH) {
      const password = prompt("스코어보드를 초기화하려면 비밀번호를 입력하세요.");
      if (password === "reset1234") { // 비밀번호: reset1234
        localStorage.removeItem('tanmakScores');
        alert("스코어보드가 초기화되었습니다.");
      } else if (password !== null) { // 사용자가 비밀번호를 입력했지만 틀렸을 경우
        alert("비밀번호가 틀렸습니다.");
      }
    }
  } else if (gameState === 'rules') {
    let buttonX = width / 2 - 100;
    let buttonY = height - 100;
    if (mouseX > buttonX && mouseX < buttonX + 200 && mouseY > buttonY && mouseY < buttonY + 50) {
      gameState = lastScreen;
    }
  }
}
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

// 게임 오버 상태
let isGameOver = false;
let finalSurvivalTime = 0;
let highScore = 0;

function setup() {
  createCanvas(800, 600);
  player = createVector(width / 2, height - 50);
  frameRate(60);
  startTime = millis();
  highScore = parseFloat(localStorage.getItem('avoidGameHighScore')) || 0;
}

function draw() {
  background(0);

  if (isGameOver) {
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
        newPattern = floor(random(6)); // 총 패턴 개수 6개로 수정
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

  // 프레임당 1~2개의 총알을 발사하여 포화 느낌을 줌
  for (let i = 0; i < 2; i++) {
    // 직선과 대각선을 포함하도록 발사 각도 조절 (60도 범위)
    let angle = barrageBaseAngle + random(-PI / 6, PI / 6);
    let speed = random(3.5, 5) + difficultyMultiplier * 0.2;
    bullets.push(
      { x: barrageSpawnPoint.x, y: barrageSpawnPoint.y, dir: angle, speed: speed }
    );
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
  for (let b of bullets) {
    b.x += cos(b.dir) * b.speed;
    b.y += sin(b.dir) * b.speed;
  }
  bullets = bullets.filter(b => b.x > -20 && b.x < width + 20 && b.y > -20 && b.y < height + 20);
}

// 총알 그리기
function drawBullets() {
  fill(255, 0, 0);
  noStroke();
  for (let b of bullets) {
    ellipse(b.x, b.y, 10);
  }
}

// 플레이어와 총알 충돌 체크
function checkCollisions() {
  if (invincible) return;
  for (let b of bullets) {
    if (dist(b.x, b.y, player.x, player.y) < playerRadius + 5) {
      health--;
      invincible = true;
      invincibilityTimer = 120;
      if (health <= 0) {
        isGameOver = true;
        finalSurvivalTime = parseFloat(((millis() - startTime) / 1000).toFixed(1));
        if (finalSurvivalTime > highScore) {
          highScore = finalSurvivalTime;
          localStorage.setItem('avoidGameHighScore', highScore);
        }
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
  let t = ((millis() - startTime) / 1000).toFixed(1);
  text(`생존 시간: ${t}초`, 10, 60);
  text(`최고 기록: ${highScore.toFixed(1)}초`, 10, 85);
}

// 일반 탄막 패턴 생성
function spawnPattern(index) {
  switch (index) {
    case 0: // 부채꼴 패턴 (Fan)
      {
        let count = floor(15 + 10 * difficultyMultiplier);
        let speed = 3 + difficultyMultiplier * 0.5;
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
    case 1: // 나선형 (Spiral)
      {
        let count = floor(10 + 10 * difficultyMultiplier);
        let t = millis() / 500;
        for (let i = 0; i < count; i++)
          bullets.push({ x: width / 2, y: height / 2, dir: t + i * 0.3, speed: 2.5 });
      }
      break;
    case 2: // 기관총 (Machine Gun)
      {
        let burstCount = floor(10 + 12 * difficultyMultiplier);
        let speed = 4.5 + difficultyMultiplier * 0.5;
        let spread = 0.5; // 탄 퍼짐 정도 (라디안)

        let side = floor(random(3)); // 0: 위, 1: 왼쪽, 2: 오른쪽
        let spawnPoint = createVector(0, 0);
        let baseAngle = 0;

        if (side === 0) { spawnPoint.set(random(width), -10); baseAngle = HALF_PI; }
        else if (side === 1) { spawnPoint.set(-10, random(height)); baseAngle = 0; }
        else { spawnPoint.set(width + 10, random(height)); baseAngle = PI; }

        for (let i = 0; i < burstCount; i++) {
          let angle = baseAngle + random(-spread / 2, spread / 2);
          let bulletSpeed = speed + random(-0.5, 0.5); // 약간의 속도 변화를 주어 '두두두' 느낌을 살림
          bullets.push({ x: spawnPoint.x, y: spawnPoint.y, dir: angle, speed: bulletSpeed });
        }
      }
      break;
    case 3: // 비 내리기 (Rain)
      {
        let count = floor(20 + 30 * difficultyMultiplier);
        for (let i = 0; i < count; i++) {
          bullets.push({ x: random(width), y: -10, dir: HALF_PI, speed: random(2, 4) });
        }
      }
      break;
    case 4: // 모서리 공격 (Corner Attack)
      {
        let count = floor(1 + 2 * difficultyMultiplier);
        let corners = [
          createVector(0, 0),
          createVector(width, 0),
          createVector(0, height),
          createVector(width, height)
        ];
        for (let corner of corners) {
          for (let i = 0; i < count; i++) {
            let angle = atan2(player.y - corner.y, player.x - corner.x) + random(-0.1, 0.1);
            bullets.push({ x: corner.x, y: corner.y, dir: angle, speed: 3 });
          }
        }
      }
      break;
    case 5: // 5초 지속 포화 (Sustained Barrage)
      {
        isBarrageActive = true;
        barrageEndTime = millis() + 5000; // 5초간 지속

        let side = floor(random(4)); // 0:위, 1:아래, 2:왼쪽, 3:오른쪽
        switch (side) {
          case 0: // 위
            barrageSpawnPoint = createVector(width / 2, -10);
            barrageBaseAngle = HALF_PI;
            break;
          case 1: // 아래
            barrageSpawnPoint = createVector(width / 2, height + 10);
            barrageBaseAngle = -HALF_PI;
            break;
          case 2: // 왼쪽
            barrageSpawnPoint = createVector(-10, height / 2);
            barrageBaseAngle = 0;
            break;
          case 3: // 오른쪽
            barrageSpawnPoint = createVector(width + 10, height / 2);
            barrageBaseAngle = PI;
            break;
        }
      }
      break;
  }
}

// 아이템 업데이트
function updateItems() {
  // 회복 아이템 등장 확률을 낮춤 (0.5% -> 0.2%)
  if (random() < 0.001) {
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

function drawGameOverScreen() {
  // 반투명 배경으로 게임 화면을 어둡게 처리
  background(0, 150);

  // "Game Over" 텍스트
  fill(255, 0, 0);
  textAlign(CENTER, CENTER);
  textSize(64);
  text("Game Over", width / 2, height / 2 - 80);

  // 최종 생존 시간 표시
  fill(255);
  textSize(24);
  text(`생존 시간: ${finalSurvivalTime}초`, width / 2, height / 2 - 20);

  // 최고 기록 표시
  fill(255, 255, 0); // 노란색으로 강조
  textSize(20);
  text(`최고 기록: ${highScore.toFixed(1)}초`, width / 2, height / 2 + 10);

  // 다시하기 버튼 영역
  let buttonX = width / 2 - 100;
  let buttonY = height / 2 + 40;
  let buttonW = 200;
  let buttonH = 50;

  // 마우스가 버튼 위에 있을 때 효과 (색상 변경 및 커서 변경)
  if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
    fill(100);
    cursor('pointer');
  } else {
    fill(50);
    cursor('default');
  }
  stroke(255);
  rect(buttonX, buttonY, buttonW, buttonH, 10); // 둥근 모서리 버튼

  // 버튼 텍스트
  noStroke();
  fill(255);
  textSize(28);
  text("다시하기", width / 2, height / 2 + 65);

  // 텍스트 정렬 초기화
  textAlign(LEFT, BASELINE);
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
  isGameOver = false;
}

function mousePressed() {
  if (isGameOver) {
    let buttonX = width / 2 - 100;
    let buttonY = height / 2 + 40;
    let buttonW = 200;
    let buttonH = 50;
    if (mouseX > buttonX && mouseX < buttonX + buttonW && mouseY > buttonY && mouseY < buttonY + buttonH) {
      restartGame();
    }
  }
}

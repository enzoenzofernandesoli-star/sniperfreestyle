const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Jogador
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 30,

    vx: 0,
    vy: 0,
    maxSpeed: 8,      // velocidade máxima
acceleration: 1, // acelera mais rápido
friction: 0.85,    // menos “freio”

    gunLength: 20,
    angle: 0,

    dashSpeed: 1000,
    dashCooldown: 1, // ms
    lastDashTime: 0

,
shieldActive: false,
shieldDuration: 3000, // 3 segundos
shieldCooldown: 10000, // 10 segundos
shieldStartTime: 0,
lastShieldTime: 0

};

let maxLives = 3;
let lives = 3;

let gameOver = false;
let paused = true;
let startTime = null;
let bullets = [];
let mousePressed = false;
let lastShotTime = 0;
const fireRate = 100; // ms entre tiros
let enemies = [];
let score = 0;
let level = 1;
let killsInLevel = 0;
let endTime = null;
let shieldBarPercent = 100;
let damageFlashAlpha = 0;   // transparência do flash
const DAMAGE_FLASH_MAX = 0.5;
const DAMAGE_FLASH_DECAY = 0.05;
let invincible = false;
let isBossLevel = false;
let boss = null;
let bossActive = false;



// tempo médio estipulado (em segundos)
const TEMPO_MEDIO = 120; // 2 minutos (ajuste se quiser)

const MIN_SPAWN_DISTANCE = 150; // distância mínima do inimigo ao jogador


let enemiesSpawned = 0; // controle de quantos nasceram na fase atual

let keys = {};

let mouseX = player.x;
let mouseY = player.y;

// Controles
document.addEventListener("keydown", (e) => {
    keys[e.code] = true;

    // DASH NO ESPAÇO
    if (e.code === "Space") {
        const now = Date.now();

        if (now - player.lastDashTime >= player.dashCooldown) {
            player.vx = Math.cos(player.angle) * player.dashSpeed;
            player.vy = Math.sin(player.angle) * player.dashSpeed;

            player.lastDashTime = now;
        }
    }

    // ESCUDO NO CAPS LOCK
    if (e.code === "CapsLock" && !paused && !gameOver) {
        const now = Date.now();

        if (
            !player.shieldActive &&
            now - player.lastShieldTime >= player.shieldCooldown
        ) {
            player.shieldActive = true;
            player.shieldStartTime = now;
            player.lastShieldTime = now;
        }
    }

});


document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
});

canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
        mousePressed = true;
    }
});

canvas.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
        mousePressed = false;
    }
});


canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});



document.getElementById("pauseBtn").addEventListener("click", () => {
    paused = !paused;
    document.getElementById("pauseBtn").textContent =
        paused ? "Continuar" : "Pausar";
});



// === BOTÃO DE TESTE: PULAR FASE ===
document.getElementById("skipBtn").addEventListener("click", () => {

    // Remove todos os inimigos atuais
    enemies.length = 0;

    // Marca a fase como concluída
    killsInLevel = Math.min(2 * level, 20);

    // Força atualização de fase
    updateEnemies();
});


function checkBossLevel() {
    // Fases 4, 8 e 12 são boss
    isBossLevel = (level % 4 === 0);

    console.log(
        isBossLevel 
        ? "⚠️ FASE DE BOSS" 
        : "✅ FASE NORMAL"
    );
}

// Função de tiro
function shoot() {
    bullets.push({
        x: player.x + Math.cos(player.angle) * player.gunLength,
        y: player.y + Math.sin(player.angle) * player.gunLength,
        size: 6,
        speed: 25,
        angle: player.angle
    });
}

function shootAllDirections() {
    const totalShots = 16; // quantidade de direções

    for (let i = 0; i < totalShots; i++) {
        const angle = (Math.PI * 2 / totalShots) * i;

        bullets.push({
            x: player.x + Math.cos(angle) * player.gunLength,
            y: player.y + Math.sin(angle) * player.gunLength,
            size: 6,
            speed: 15,
            angle: angle
        });
    }
}

function spawnBoss() {
    boss = {
        x: canvas.width / 2,
        y: 100,
        size: 100,
        maxLife: 10 + level * 5, // vida proporcional à fase
        life: 10 + level * 5,
        speed: 2 + level * 0.2,
        attackCooldown: 1000 - level * 50, // diminui cooldown a cada fase
        lastAttackTime: 0,
        pattern: 1
    };
    bossActive = true;
    isBossLevel = true;
}


// spawnEnemy atualizado: progressão aritmética 2*level, cap 20, distância mínima 40
function spawnEnemy() {

    if (isBossLevel) return; // 🚫 bloqueia inimigos normais

    let maxEnemies = Math.min(2 * level, 20);

    if (enemiesSpawned >= maxEnemies) return;

    let x, y, dist;
    let tentativas = 0;
    const MAX_TENTATIVAS = 100;

    do {
        x = Math.random() * canvas.width;
        y = Math.random() * canvas.height;
        dist = Math.hypot(x - player.x, y - player.y);
        tentativas++;
    } while (dist < MIN_SPAWN_DISTANCE && tentativas < MAX_TENTATIVAS);

    if (tentativas >= MAX_TENTATIVAS) return;

    let baseLife = 1 + Math.floor(level / 5);

    enemies.push({
        x: x,
        y: y,
        radius: 20 + Math.floor(baseLife / 2),
        speed: 1 + level * 0.05,
        life: baseLife,
        dirX: 0,
        dirY: 0
    });

    enemiesSpawned++;
}

function updateBoss() {
    if (!bossActive) return;

    // Movimento simples horizontal
    boss.x += boss.speed;
    if (boss.x + boss.size/2 > canvas.width || boss.x - boss.size/2 < 0) {
        boss.speed *= -1; // inverte ao bater nas bordas
    }

    // Ataque do boss
    const now = Date.now();
    if (now - boss.lastAttackTime >= boss.attackCooldown) {
        const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
        bullets.push({
            x: boss.x,
            y: boss.y,
            size: 8,
            speed: 5,
            angle: angle,
            fromBoss: true,
            color: "red"
        });
        boss.lastAttackTime = now;
    }
}


function checkBossHit() {
    if (!bossActive) return;

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];

        if (b.fromBoss) continue; // ignora tiros do boss

        const dist = Math.hypot(b.x - boss.x, b.y - boss.y);

        if (dist < boss.size / 2) {
            boss.life--;
            bullets.splice(i, 1);

            if (boss.life <= 0) {
                bossActive = false;
                isBossLevel = false;

                level++;
                killsInLevel = 0;
                enemiesSpawned = 0;

                document.getElementById("level").textContent = level;
            }
        }
    }
}

// Atualiza posições do jogador
function updatePlayer() {
    let ax = 0;
    let ay = 0;

    if (keys["KeyW"] || keys["ArrowUp"]) ay -= player.acceleration;
    if (keys["KeyS"] || keys["ArrowDown"]) ay += player.acceleration;
    if (keys["KeyA"] || keys["ArrowLeft"]) ax -= player.acceleration;
    if (keys["KeyD"] || keys["ArrowRight"]) ax += player.acceleration;

    player.vx += ax;
    player.vy += ay;

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > player.maxSpeed) {
        player.vx = (player.vx / speed) * player.maxSpeed;
        player.vy = (player.vy / speed) * player.maxSpeed;
    }

    player.vx *= player.friction;
    player.vy *= player.friction;

// parar totalmente se a velocidade for muito pequena
if (Math.abs(player.vx) < 0.05) player.vx = 0;
if (Math.abs(player.vy) < 0.05) player.vy = 0;


    player.x += player.vx;
    player.y += player.vy;

    player.x = Math.max(0, Math.min(canvas.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height, player.y));
}

// Atualiza projéteis (iterando de trás para frente para remover com segurança)
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        // Remover projéteis fora da tela
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            bullets.splice(i, 1);
        }
    }
}

let damageCooldown = false;

function takeDamage() {
    if (player.shieldActive || gameOver || invincible) return;

    lives--;
    invincible = true;

    damageFlashAlpha = DAMAGE_FLASH_MAX;

    // 1 segundo de invencibilidade
    setTimeout(() => {
        invincible = false;
    }, 1000);

    if (lives <= 0) {
        showGameOverScreen();
    }
}



// Atualiza inimigos (iterando de trás para frente)
function updateEnemies() {
    // limite aritmético desta fase (reuso para checagem de troca de fase)
    let maxEnemiesThisLevel = Math.min(2 * level, 20);

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        // Movimento padronizado: perseguir o jogador (sem aleatoriedade)
        let angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.dirX = Math.cos(angle);
        e.dirY = Math.sin(angle);

        e.x += e.dirX * e.speed;
        e.y += e.dirY * e.speed;

        // Colisão bala-inimigo
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            const distBullet = Math.hypot(b.x - e.x, b.y - e.y);
            if (distBullet < e.radius) {
                // dano: reduzir vida do inimigo, remover a bala
                e.life--;
                bullets.splice(bi, 1);

                if (e.life <= 0) {
                    enemies.splice(i, 1);
                    score++;
                    killsInLevel++;

                    document.getElementById("score").textContent = score;
                }
                break; // bala colidiu com este inimigo; passar para próximo inimigo
            }
        }

        // Checar colisão inimigo-jogador
        const distPlayer = Math.hypot(player.x - e.x, player.y - e.y);
        if (distPlayer < player.size / 2 + e.radius) {

    // SE ESCUDO ATIVO, NÃO MORRE
    if (player.shieldActive) {
        continue;
    }

    if (!gameOver) {
    takeDamage();
}
return;
}
}


    // Troca de fase: apenas quando matou todos os inimigos da fase (kills >= limite da fase)
    if (killsInLevel >= maxEnemiesThisLevel) {

    // Se terminou a última fase (fase 10 = 20 inimigos)
    if (level >= 12) {
        finishGame();
        return;
    }

    // Próxima fase
    level++;
killsInLevel = 0;
enemiesSpawned = 0;

checkBossLevel();

if (isBossLevel) {
    spawnBoss(); // 👹 NASCE O BOSS
}

document.getElementById("level").textContent = level;
}
}

// Desenhos
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // corpo
    ctx.fillStyle = "blue";
    ctx.fillRect(-player.size/2, -player.size/2, player.size, player.size);

    // arma
    ctx.fillStyle = "blue";
    ctx.fillRect(0, -5, player.gunLength, 10);

// ESCUDO VISUAL AMARELO
if (player.shieldActive) {
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, player.size, 0, Math.PI * 2);
    ctx.stroke();
}


    ctx.restore();
}

function drawBullets() {
    bullets.forEach(b => {
        ctx.fillStyle = b.color || "white"; // 🔥 boss = orange, player = white
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
    });
}


function drawEnemies() {
    ctx.fillStyle = "red";
    enemies.forEach(e => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();

        // Desenhar vida pequena sobre o inimigo (opcional)
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(e.life, e.x, e.y + 4);
        ctx.fillStyle = "red";
    });
}

function drawBoss() {
    if (!bossActive) return;

    ctx.fillStyle = "purple";
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.size / 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawBossLifeBar() {
    if (!bossActive) return;

    const barWidth = 300;
    const barHeight = 20;
    const x = canvas.width/2 - barWidth/2;
    const y = 20;

    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "purple";
    ctx.fillRect(x, y, (boss.life / boss.maxLife) * barWidth, barHeight);

    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BOSS", canvas.width/2, y-5);
}

function drawLives() {
    ctx.font = "24px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    let hearts = "";
    for (let i = 0; i < lives; i++) {
        hearts += "❤️ ";
    }

    ctx.fillText(hearts, 20, 20);
}

// ===== BARRA DE ESCUDO =====
function drawShieldBar() {
    const barWidth = 200;
    const barHeight = 15;
    const x = 20;
    const y = canvas.height - 30;

    // fundo
    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, barWidth, barHeight);

    // preenchimento
    ctx.fillStyle = "yellow";
    ctx.fillRect(
        x,
        y,
        (shieldBarPercent / 100) * barWidth,
        barHeight
    );

    // borda
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, barWidth, barHeight);

    // texto
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText("ESCUDO", x, y - 5);
}


// SPAWN DE INIMIGOS (restaurado)
setInterval(() => {
    if (!paused && !gameOver) {
        spawnEnemy();
    }
}, 800);

// spawn periódico — spawnEnemy respeita o limite da fase
let lastSpawnTime = 0;
const spawnDelay = 800;



function gameLoop() {
    if (gameOver) return;

    requestAnimationFrame(gameLoop);

    if (paused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

// rotação suave do jogador (sem bug)
const targetAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
let delta = targetAngle - player.angle;

if (delta > Math.PI) delta -= Math.PI * 2;
if (delta < -Math.PI) delta += Math.PI * 2;

player.angle += delta * 0.15;

// ATUALIZAR BARRA DO ESCUDO
if (player.shieldActive) {
    const elapsed = Date.now() - player.shieldStartTime;
    shieldBarPercent = Math.max(
        0,
        100 - (elapsed / player.shieldDuration) * 100
    );
} else {
    const elapsedCooldown = Date.now() - player.lastShieldTime;
    shieldBarPercent = Math.min(
        100,
        (elapsedCooldown / player.shieldCooldown) * 100
    );
}


// DESATIVAR ESCUDO APÓS TEMPO
if (
    player.shieldActive &&
    Date.now() - player.shieldStartTime >= player.shieldDuration
) {
    player.shieldActive = false;
}

function checkBossCollisions() {
    if (!bossActive) return;

    // colisão corpo
    const distPlayer = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (distPlayer < player.size/2 + boss.size/2) {
        takeDamage();
    }

    // projéteis do boss
    bullets.forEach((b,i) => {
        if (b.fromBoss) {
            const dist = Math.hypot(player.x - b.x, player.y - b.y);
            if (dist < player.size/2 + b.size) {
                takeDamage();
                bullets.splice(i,1);
            }
        }
    });
}

if (bossActive && boss.life <= 0) {
    bossActive = false;
    isBossLevel = false;
    level++;
    killsInLevel = 0;
    enemiesSpawned = 0;
    document.getElementById("level").textContent = level;
}




updatePlayer();
updateBullets();
updateEnemies();
updateBoss();
checkBossCollisions();
checkBossHit();


if (mousePressed) {
    const now = Date.now();

    if (now - lastShotTime >= fireRate) {

        // SE SHIFT ESTIVER PRESSIONADO → TIRO 360°
        if (keys["ShiftLeft"]) {
            shootAllDirections();
        } 
        // SENÃO → TIRO NORMAL
        else {
            shoot();
        }

        lastShotTime = now;
    }
}



    drawPlayer();
    drawBullets();
    drawEnemies();
    drawBoss();          
    drawBossLifeBar();
    drawShieldBar();
    drawLives();

// ===== DESENHAR FLASH DE DANO =====
if (damageFlashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 0, 0, ${damageFlashAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    damageFlashAlpha -= DAMAGE_FLASH_DECAY;
}
}


// inicializa HUD
document.getElementById("score").textContent = score;
document.getElementById("level").textContent = level;


function finishGame() {
    gameOver = true;
    endTime = Date.now();

    const tempoTotal = ((endTime - startTime) / 1000).toFixed(1);

    let avaliacao = "";
    if (tempoTotal > TEMPO_MEDIO) {
        avaliacao = "Muito lento 🐢";
    } else {
        avaliacao = "Você é o Flash? ⚡";
    }

    // Tela final simples
    document.body.innerHTML = `
        <div style="
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            height:100vh;
            background:#111;
            color:white;
            font-family:Arial;
            text-align:center;
        ">
            <h1>🎉 O GLORIA,Finalmente você passou!</h1>

            <p>⏱️ Seu tempo: <strong>${tempoTotal}s</strong></p>
            <p>⏱️ Tempo médio: ${TEMPO_MEDIO}s</p>

            <h2>${avaliacao}</h2>

            <button style="
                margin-top:20px;
                padding:10px 20px;
                font-size:18px;
                cursor:pointer;
            " onclick="location.reload()">
                🔁 Reiniciar
            </button>
        </div>
    `;
}


function showGameOverScreen() {
    if (gameOver) return; // ← TRAVA PRINCIPAL
    gameOver = true;

    endTime = Date.now();

    const tempoTotal = ((endTime - startTime) / 1000).toFixed(1);

    document.body.innerHTML = `
        <div style="
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            height:100vh;
            background:#111;
            color:white;
            font-family:Arial;
            text-align:center;
        ">
            <h1 style="color:red;">💀 GAME OVER</h1>

            <p>⏱️ Seu tempo: <strong>${tempoTotal}s</strong></p>

            <button style="
                margin-top:20px;
                padding:10px 20px;
                font-size:18px;
                cursor:pointer;
            " onclick="location.reload()">
                🔁 Reiniciar
            </button>
        </div>
    `;
}

function startGame() {
    document.getElementById("startScreen").style.display = "none";
    paused = false;
    startTime = Date.now();

    checkBossLevel(); // 👈 ADICIONADO
}



gameLoop();

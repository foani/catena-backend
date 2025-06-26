const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// JSON 파일 경로
const DATABASE_FILE = path.join(__dirname, 'database.json');
const RANKINGS_FILE = path.join(__dirname, 'rankings.json');
const LOG_FILE = path.join(__dirname, 'logs', 'server.log');

// 미들웨어 설정
app.use(cors({
    origin: true,  // 모든 origin 허용 (외부 접속 지원)
    credentials: true
}));
app.use(express.json());

// 데이터 초기화
const initializeDatabase = async () => {
    try {
        // database.json 초기화
        if (!await fs.pathExists(DATABASE_FILE)) {
            await fs.writeJson(DATABASE_FILE, {
                users: [],
                lastUpdated: new Date().toISOString()
            });
            console.log('✅ database.json 생성 완료');
        }

        // rankings.json 초기화
        if (!await fs.pathExists(RANKINGS_FILE)) {
            await fs.writeJson(RANKINGS_FILE, {
                rankings: [],
                lastUpdated: new Date().toISOString()
            });
            console.log('✅ rankings.json 생성 완료');
        }

        // logs 폴더 생성
        await fs.ensureDir(path.dirname(LOG_FILE));
        console.log('✅ 데이터베이스 초기화 완료');

    } catch (error) {
        console.error('❌ 데이터베이스 초기화 실패:', error);
    }
};

// 유틸리티 함수
const generateId = () => Date.now() + '_' + Math.random().toString(36).substr(2);

const logToFile = (message) => {
    try {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
        console.error('로그 기록 실패:', error);
    }
};

// API 라우트

// 1. 랭킹 조회 API
app.get('/api/rankings', async (req, res) => {
    try {
        const data = await fs.readJson(DATABASE_FILE);
        
        // 점수로 정렬 (내림차순)
        const sortedUsers = data.users
            .filter(user => user.score > 0) // 점수가 0보다 큰 사용자만
            .sort((a, b) => Number(b.score) - Number(a.score)) // 높은 점수 -> 낮은 점수
            .map((user, index) => ({
                ...user,
                rank: index + 1
            }));

        // 랭킹 파일 업데이트
        await fs.writeJson(RANKINGS_FILE, {
            rankings: sortedUsers,
            lastUpdated: new Date().toISOString()
        });

        logToFile(`GET /api/rankings - ${sortedUsers.length}명 조회`);
        
        res.json({
            success: true,
            data: sortedUsers,
            count: sortedUsers.length
        });

    } catch (error) {
        console.error('랭킹 조회 오류:', error);
        logToFile(`ERROR /api/rankings - ${error.message}`);
        res.status(500).json({
            success: false,
            error: '랭킹 조회 실패'
        });
    }
});

// 2. 점수 업데이트 API
app.post('/api/update-score', async (req, res) => {
    try {
        // 🔮 디버깅: 요청 데이터 로깅
        console.log('🔮 [DEBUG] /api/update-score 요청 데이터:');
        console.log('- Headers:', req.headers);
        console.log('- Body:', req.body);
        console.log('- Content-Type:', req.get('Content-Type'));
        
        logToFile(`DEBUG /api/update-score - Headers: ${JSON.stringify(req.headers)}, Body: ${JSON.stringify(req.body)}`);
        
        const { email, score, ctt_points, full_name } = req.body;

        console.log('🔮 [DEBUG] 파싱된 데이터:', { email, score, ctt_points, full_name });

        if (!email) {
            console.log('❌ [ERROR] email이 누락되었습니다');
            return res.status(400).json({
                success: false,
                error: 'email은 필수입니다'
            });
        }

        const data = await fs.readJson(DATABASE_FILE);
        
        // 기존 사용자 찾기
        let userIndex = data.users.findIndex(u => u.email === email);
        let user;

        console.log(`🔍 [DEBUG] 사용자 검색 결과: userIndex=${userIndex}`);

        if (userIndex !== -1) {
            // 기존 사용자 업데이트
            user = data.users[userIndex];
            console.log(`🔄 [DEBUG] 기존 사용자 업데이트:`, {
                before: { score: user.score, ctt_points: user.ctt_points },
                after: { score: Number(score), ctt_points: Number(ctt_points) }
            });
            
            user.score = score !== undefined ? Number(score) : user.score;
            user.ctt_points = ctt_points !== undefined ? Number(ctt_points) : user.ctt_points;
            user.full_name = full_name || user.full_name;
            user.updated_at = new Date().toISOString();
        } else {
            // 새 사용자 생성
            console.log(`✨ [DEBUG] 새 사용자 생성:`, { email, full_name, score, ctt_points });
            
            user = {
                id: generateId(),
                email,
                full_name: full_name || 'User',
                score: Number(score) || 0,
                ctt_points: Number(ctt_points) || 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            data.users.push(user);
        }

        // 파일 저장
        data.lastUpdated = new Date().toISOString();
        await fs.writeJson(DATABASE_FILE, data);
        
        console.log(`✅ [DEBUG] 데이터베이스 저장 완료:`, {
            email: user.email,
            score: user.score,
            ctt_points: user.ctt_points
        });

        // 새로운 랭킹 계산
        const newRank = data.users
            .filter(u => Number(u.score) > Number(user.score)).length + 1;

        logToFile(`POST /api/update-score - ${email}: ${user.score}점, 랭킹 ${newRank}위`);

        console.log(`🏆 [DEBUG] 업데이트 성공:`, { email, newRank, final_ctt_points: user.ctt_points });

        res.json({
            success: true,
            user,
            newRank
        });

    } catch (error) {
        console.error('💥 [ERROR] 점수 업데이트 오류:', error);
        logToFile(`ERROR /api/update-score - ${error.message}`);
        res.status(500).json({
            success: false,
            error: '점수 업데이트 실패'
        });
    }
});

// 3. 사용자 등록/로그인 API
app.post('/api/register', async (req, res) => {
    try {
        const { full_name, email, walletAddress } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'email은 필수입니다'
            });
        }

        const data = await fs.readJson(DATABASE_FILE);
        
        // 기존 사용자 확인
        let existingUser = data.users.find(u => u.email === email);
        let isNewUser = false;

        if (existingUser) {
            // 기존 사용자 정보 업데이트
            existingUser.full_name = full_name || existingUser.full_name;
            existingUser.walletAddress = walletAddress || existingUser.walletAddress;
            existingUser.updated_at = new Date().toISOString();
            
            logToFile(`POST /api/register - 기존 사용자 로그인: ${email}`);
        } else {
            // 새 사용자 생성
            existingUser = {
                id: generateId(),
                full_name: full_name || 'User',
                email,
                walletAddress: walletAddress || '',
                score: 0,
                ctt_points: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            data.users.push(existingUser);
            isNewUser = true;
            
            logToFile(`POST /api/register - 새 사용자 등록: ${email}`);
        }

        // 파일 저장
        data.lastUpdated = new Date().toISOString();
        await fs.writeJson(DATABASE_FILE, data);

        res.json({
            success: true,
            user: existingUser,
            isNewUser
        });

    } catch (error) {
        console.error('사용자 등록 오류:', error);
        logToFile(`ERROR /api/register - ${error.message}`);
        res.status(500).json({
            success: false,
            error: '사용자 등록 실패'
        });
    }
});

// 헬스체크 API
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Catena Backend Server is running!',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// 관리용 API (개발용)
app.get('/api/admin/users', async (req, res) => {
    try {
        const data = await fs.readJson(DATABASE_FILE);
        res.json({
            success: true,
            users: data.users,
            count: data.users.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '사용자 조회 실패'
        });
    }
});

// 🗑️ 개별 사용자 삭제 API
app.delete('/api/admin/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const data = await fs.readJson(DATABASE_FILE);
        
        // 사용자 찾기
        const userIndex = data.users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '사용자를 찾을 수 없습니다'
            });
        }
        
        const deletedUser = data.users[userIndex];
        
        // 중요한 사용자 보호 (실제 사용자 삭제 방지)
        const protectedEmails = [
            'tradenbot@gmail.com',  // gina park
            'john.choi775@gmail.com',  // john choi
            'allbandex@gmail.com',  // all band
            'creatanetwork@gmail.com'  // creatanetwork
        ];
        
        if (protectedEmails.includes(deletedUser.email)) {
            return res.status(403).json({
                success: false,
                error: '실제 사용자는 삭제할 수 없습니다'
            });
        }
        
        // 사용자 삭제
        data.users.splice(userIndex, 1);
        data.lastUpdated = new Date().toISOString();
        
        // 파일 저장
        await fs.writeJson(DATABASE_FILE, data);
        
        logToFile(`DELETE /api/admin/users/${userId} - 사용자 삭제: ${deletedUser.email}`);
        
        res.json({
            success: true,
            message: '사용자가 삭제되었습니다',
            deletedUser: {
                id: deletedUser.id,
                full_name: deletedUser.full_name,
                email: deletedUser.email
            }
        });
        
    } catch (error) {
        console.error('사용자 삭제 오류:', error);
        logToFile(`ERROR DELETE /api/admin/users - ${error.message}`);
        res.status(500).json({
            success: false,
            error: '사용자 삭제 실패'
        });
    }
});

// 🧹 테스트 사용자 일괄 삭제 API
app.delete('/api/admin/cleanup-test-users', async (req, res) => {
    try {
        const data = await fs.readJson(DATABASE_FILE);
        
        // 실제 사용자 보호 목록
        const protectedEmails = [
            'tradenbot@gmail.com',  // gina park
            'john.choi775@gmail.com',  // john choi
            'allbandex@gmail.com',  // all band
            'creatanetwork@gmail.com'  // creatanetwork
        ];
        
        // 테스트 사용자 패턴 정의
        const testUserPatterns = [
            /^test@/i,  // test@example.com
            /^user_.*@gmail\.com$/i,  // user_xxxxx@gmail.com
            /^user_.*@kakao\.com$/i,  // user_xxxxx@kakao.com
            /^kakao_user_.*@kakao\.com$/i,  // kakao_user_xxxxx@kakao.com
            /^Google User/i,  // Google User xxxxx
            /^카카오 사용자/i  // 카카오 사용자 xxxxx
        ];
        
        const originalCount = data.users.length;
        
        // 테스트 사용자 필터링 (실제 사용자만 남기기)
        data.users = data.users.filter(user => {
            // 보호된 이메일은 유지
            if (protectedEmails.includes(user.email)) {
                return true;
            }
            
            // 테스트 사용자 패턴에 맞으면 삭제
            const isTestUser = testUserPatterns.some(pattern => 
                pattern.test(user.email) || pattern.test(user.full_name)
            );
            
            return !isTestUser;  // 테스트 사용자가 아니면 유지
        });
        
        const deletedCount = originalCount - data.users.length;
        data.lastUpdated = new Date().toISOString();
        
        // 파일 저장
        await fs.writeJson(DATABASE_FILE, data);
        
        logToFile(`DELETE /api/admin/cleanup-test-users - ${deletedCount}명의 테스트 사용자 삭제`);
        
        res.json({
            success: true,
            message: `${deletedCount}명의 테스트 사용자가 삭제되었습니다`,
            deletedCount,
            remainingCount: data.users.length,
            protectedUsers: data.users.map(u => ({ name: u.full_name, email: u.email }))
        });
        
    } catch (error) {
        console.error('테스트 사용자 정리 오류:', error);
        logToFile(`ERROR DELETE /api/admin/cleanup-test-users - ${error.message}`);
        res.status(500).json({
            success: false,
            error: '테스트 사용자 정리 실패'
        });
    }
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
    console.error('서버 오류:', err);
    logToFile(`SERVER ERROR - ${err.message}`);
    res.status(500).json({
        success: false,
        error: '서버 내부 오류'
    });
});

// 404 핸들링
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'API 엔드포인트를 찾을 수 없습니다'
    });
});

// 서버 시작
const startServer = async () => {
    try {
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`🚀 Catena Backend Server running on http://localhost:${PORT}`);
            console.log(`📊 프론트엔드 연결: http://localhost:5173`);
            console.log(`💾 데이터베이스: ${DATABASE_FILE}`);
            console.log(`🏆 랭킹 파일: ${RANKINGS_FILE}`);
            console.log(`📝 로그 파일: ${LOG_FILE}`);
            console.log('');
            console.log('📌 API 엔드포인트:');
            console.log('   GET    /api/health       - 서버 상태 확인');
            console.log('   GET    /api/rankings     - 랭킹 조회');
            console.log('   POST   /api/update-score - 점수 업데이트');
            console.log('   POST   /api/register     - 사용자 등록/로그인');
            console.log('   GET    /api/admin/users  - 전체 사용자 조회 (개발용)');
            console.log('   DELETE /api/admin/users/:userId - 개별 사용자 삭제 (관리자용)');
            console.log('   DELETE /api/admin/cleanup-test-users - 테스트 사용자 일괄 삭제 (관리자용)');
            
            logToFile('Catena Backend Server started successfully');
        });
        
    } catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
};

startServer();
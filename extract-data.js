const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const readline = require('readline');  // readline 모듈 추가

(async () => {
    // 📌 1. 엑셀 파일 불러오기
    const workbook = XLSX.readFile('data_address.xlsx');
    const sheetName = workbook.SheetNames[0]; // 첫 번째 시트 선택
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { raw: false }); // 엑셀 데이터를 JSON 형태로 변환
    const length = 9669;

    // 📌 2. 브라우저 실행
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://kras.seoul.go.kr/land_info/info/baseInfo/baseInfo.do', {
        waitUntil: 'networkidle2'
    });

    // 📌 3. 데이터 입력 및 검색 반복 실행
    for (let i = 0; i < length; i++) { // 9688 데이터임 이후로는 틀밖에 없음.
        const row = data[i];
        console.log(`🔍 검색 중: ${row.관할구청} - ${row.법정동} - ${row.본번} - ${row.부번} - ${row.층}`);

        // 📌 시군구 선택 후 읍면동 옵션 로딩 대기
        console.log('🔄 시군구 선택 후 읍면동 로딩 대기');
        await page.select('#sggnm', getDistrictCode(row.관할구청));

        await page.waitForFunction(() => {
            const options = document.querySelectorAll('#umdnm option');
            return options.length > 1 && options[1].value !== ''; // '읍,면,동' 외 다른 옵션이 로드되었는지 확인
        });

        console.log('📍 읍면동 옵션 로딩 완료');
        
        // ④ 법정동 선택 (select) - 읍면동이 로드된 후 선택
        const townCode = getTownCode(row.법정동);  // 법정동 코드 가져오기
        if (!townCode) {
            console.log(`🔴 법정동 코드가 없거나 잘못된 값: ${row.법정동}`);
        } else {
            console.log(`🌍 읍면동 코드: ${townCode}`);

            // 읍면동 선택
            await page.select('#umdnm', townCode);
            console.log(`📍 읍면동 선택 완료`);
        }

        // 본번과 부번을 항상 4자리 문자열로 유지
        const 본번 = row.본번.toString().padStart(4, '0');
        const 부번 = row.부번.toString().padStart(4, '0');

        // ③ 본번 입력 (input)
        await page.type('#textfield', 본번, { delay: 100 });

        // ④ 부번 입력 (input)
        await page.type('#textfield2', 부번, { delay: 100 });

        // ⑤ 검색 버튼 클릭
        await page.waitForSelector('#searching a');
        await page.click('#searching a');

        console.log('검색 중...')

        // ⑥ 검색 결과 로딩 대기 (5초 대기)
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('✅ 검색 완료!');

        // ⑦ "개별공시지가" 탭 클릭
        await page.waitForSelector('a[title="개별공시지가 탭 선택"]', { visible: true });
        await page.click('a[title="개별공시지가 탭 선택"]');
        console.log('개별공시지가 탭 선택');

        // ⑧ 가격기준년도와 개별공시지가 가져오기
        const landPriceData = await page.evaluate(() => {
            const rows = document.querySelectorAll('.table0202 tbody tr');

            for (const row of rows) {
                const yearCell = row.querySelector('td[headers="YEAR"]');
                const priceCell = row.querySelector('td[headers="JIGA"]');

                if (yearCell && priceCell) {
                    const year = yearCell.innerText.trim();
                    const price = priceCell.innerText.trim();

                    if (year === '2024') {
                        return { year, price };
                    }
                }
            }
            return null;
        });

        if (landPriceData) {
            console.log(`💡 ${landPriceData.year}년 개별공시지가: ${landPriceData.price}`);

            // 📌 8번째 열(시가표준)에 개별공시지가 값을 추가
            const rowIndex = i + 2; // 엑셀에서 1부터 시작하므로 +2
            const 시가표준셀 = 'H' + rowIndex;
            sheet[시가표준셀] = { t: 's', v: landPriceData.price }; // 엑셀 값 업데이트

            console.log(`📌 ${rowIndex}행의 '시가표준' 값이 업데이트되었습니다.`);
        } else {
            console.log("⚠️ 2024년 개별공시지가를 찾을 수 없습니다.");
        }

        // 📌 엑셀에 값 저장
        XLSX.writeFile(workbook, 'data_address.xlsx');
        console.log("✅ 개별공시지가를 엑셀에 저장했습니다.");

        //📌 모든 입력 값 초기화 후 다시 선택
        await page.select('#sggnm', '');  // 시군구 리셋
        await page.select('#umdnm', '');  // 읍면동 리셋
        // 본번과 부번 초기화
        await page.evaluate(() => {
            document.querySelector('#textfield').value = '';  
            document.querySelector('#textfield2').value = '';
        });

        console.log("📌 모든 입력 값을 초기화했습니다.");

        // 3초 대기 후 다음 데이터로 넘어가기
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 📌 사용자가 Enter 키를 눌러야 브라우저 닫힘
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question(() => {
        browser.close();
        rl.close();
    });
})();

// 🔹 관할구청 이름을 코드로 변환하는 함수
function getDistrictCode(name) {
    const districts = {
        '강남구': '1168000000',
        '강동구': '1174000000',
        '강북구': '1130500000',
        '강서구': '1150000000',
        '관악구': '1162000000',
        '광진구': '1121500000',
        '구로구': '1153000000',
        '금천구': '1154500000',
        '노원구': '1135000000',
        '도봉구': '1132000000',
        '동대문구': '1123000000',
        '동작구': '1159000000',
        '마포구': '1144000000',
        '서대문구': '1141000000',
        '서초구': '1165000000',
        '성동구': '1120000000',
        '성북구': '1129000000',
        '송파구': '1171000000',
        '양천구': '1147000000',
        '영등포구': '1156000000',
        '용산구': '1117000000',
        '은평구': '1138000000',
        '종로구': '1111000000',
        '중구': '1114000000',
        '중랑구': '1126000000'
    };
    return districts[name] || ''; // 기본적으로 값이 없으면 빈 문자열 반환
}

// 🔹 법정동 이름을 코드로 변환하는 함수
function getTownCode(name) {
    const towns = {
        '가회동': '1111014600',
        '견지동': '1111012900',
        '경운동': '1111013400',
        '계동': '1111014800',
        '공평동': '1111012700',
        '관수동': '1111015500',
        '관철동': '1111013500',
        '관훈동': '1111012800',
        '교남동': '1111017600',
        '교북동': '1111018000',
        '구기동': '1111018200',
        '궁정동': '1111010300',
        '권농동': '1111013100',
        '낙원동': '1111013700',
        '내수동': '1111011800',
        '내자동': '1111011400',
        '누상동': '1111010900',
        '누하동': '1111011000',
        '당주동': '1111011700',
        '도렴동': '1111011600',
        '돈의동': '1111015300',
        '동숭동': '1111016800',
        '명륜1가': '1111017000',
        '명륜2가': '1111017100',
        '명륜3가': '1111017300',
        '명륜4가': '1111017200',
        '묘동': '1111015100',
        '무악동': '1111018700',
        '봉익동': '1111015200',
        '부암동': '1111018400',
        '사간동': '1111014400',
        '사직동': '1111011500',
        '삼청동': '1111014000',
        '서린동': '1111012300',
        '세종로': '1111011900',
        '소격동': '1111014200',
        '송월동': '1111017800',
        '송현동': '1111014500',
        '수송동': '1111012400',
        '숭인동': '1111017500',
        '신교동': '1111010200',
        '신문로1가': '1111012000',
        '신문로2가': '1111012100',
        '신영동': '1111018600',
        '안국동': '1111014100',
        '연건동': '1111016600',
        '연지동': '1111016000',
        '예지동': '1111015800',
        '옥인동': '1111011100',
        '와룡동': '1111013000',
        '운니동': '1111013200',
        '원남동': '1111015900',
        '원서동': '1111014900',
        '이화동': '1111016500',
        '익선동': '1111013300',
        '인사동': '1111013600',
        '인의동': '1111015700',
        '장사동': '1111015400',
        '재동': '1111014700',
        '적선동': '1111010700',
        '종로1가': '1111012600',
        '종로2가': '1111013800',
        '종로3가': '1111015600',
        '종로4가': '1111016100',
        '종로5가': '1111016300',
        '종로6가': '1111016400',
        '중학동': '1111012500',
        '창성동': '1111010500',
        '창신동': '1111017400',
        '청운동': '1111010100',
        '청진동': '1111012200',
        '체부동': '1111011200',
        '충신동': '1111016700',
        '통의동': '1111010600',
        '통인동': '1111010800',
        '팔판동': '1111013900',
        '평동': '1111017700',
        '평창동': '1111018300',
        '필운동': '1111011300',
        '행촌동': '1111018100',
        '혜화동': '1111016900',
        '홍지동': '1111018500',
        '홍파동': '1111017900',
        '화동': '1111014300',
        '효자동': '1111010400',
        '효제동': '1111016200',
        '훈정동': '1111015000'
    };
    return towns[name] || '';
}
const puppeteer = require('puppeteer');
const XLSX = require('xlsx');

(async () => {
    // 📌 1. 엑셀 파일 불러오기
    const workbook = XLSX.readFile('data.xlsx'); // 🔹 여기에 사용자의 엑셀 파일 이름 입력
    const sheetName = workbook.SheetNames[0]; // 첫 번째 시트 선택
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet); // 엑셀 데이터를 JSON 형태로 변환

    // 📌 2. 브라우저 실행
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://kras.seoul.go.kr/land_info/info/baseInfo/baseInfo.do', {
        waitUntil: 'networkidle2'
    });

    // 📌 3. 데이터 입력 및 검색 반복 실행
    for (const row of data) {

        // ① 관할구청(시군구) 선택
        await page.select('#sggnm', getDistrictCode(row.관할구청));

        // ⑥ 검색 버튼 클릭
        await page.click('#searchBtn');

        // ⑦ 검색 결과 로딩 대기 (최대 3초)
        await page.waitForTimeout(5000);
    }

    console.log("✅ 모든 검색이 완료되었습니다!");
})();

// 🔹 관할구청 이름을 코드로 변환하는 함수
function getDistrictCode(name) {
    const districts = {
        '종로구': '1111000000',
        '중구': '1114000000',
        '용산구': '1117000000',
        '성동구': '1120000000',
        '광진구': '1121500000',
        '동대문구': '1123000000',
        '중랑구': '1126000000',
        '성북구': '1129000000',
        '강북구': '1130500000',
        '도봉구': '1132000000',
        '노원구': '1135000000',
        '은평구': '1138000000',
        '서대문구': '1141000000',
        '마포구': '1144000000',
        '양천구': '1147000000',
        '강서구': '1150000000',
        '구로구': '1153000000',
        '금천구': '1154500000',
        '영등포구': '1156000000',
        '동작구': '1159000000',
        '관악구': '1162000000',
        '서초구': '1165000000',
        '강남구': '1168000000',
        '송파구': '1171000000',
        '강동구': '1174000000'
    };
    return districts[name] || ''; // 기본적으로 값이 없으면 빈 문자열 반환
}

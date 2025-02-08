const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false }); // headless: false → 실제 브라우저 창이 열림
    const page = await browser.newPage();
    
    // 사이트 오픈
    await page.goto('https://kras.seoul.go.kr/land_info/info/baseInfo/baseInfo.do', {
        waitUntil: 'networkidle2' // 페이지 로드 완료 후 실행
    });

    // 1초 대기 (사이트가 완전히 로딩될 시간을 줌)
    await page.waitForTimeout(1000);

    // #sggnm 요소가 로드될 때까지 대기
    await page.waitForSelector('#sggnm');

    // 강서구 선택 (option value="1150000000")
    await page.select('#sggnm', '1150000000');

    // 강서구가 선택되었는지 확인
    const selectedValue = await page.evaluate(() => document.querySelector('#sggnm').value);
    console.log(`선택된 값: ${selectedValue}`); // 콘솔에 선택된 값 출력

    // 브라우저 종료 없이 유지 (직접 종료해야 함)
})();

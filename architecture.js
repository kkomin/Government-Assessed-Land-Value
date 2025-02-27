
const fs = require("fs");
const puppeteer = require("puppeteer");
const ExcelJS = require("exceljs");

(async () => {
    // 1. 브라우저 실행
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--start-maximized"],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 웹 사이트 접속
    await page.goto("https://etax.seoul.go.kr/index.html?20250205", { waitUntil: "load" });


    // ✅ iframe 확인
    const frames = await page.frames();
    console.log(`🔍 발견된 iframe 개수: ${frames.length}개`);

    let menuFrame = null;
    let buttonFound = false;

    for (const frame of frames) {
        // 2️⃣ 팝업 닫기 (이미지 클릭)
        try {
            // 팝업 닫기 이미지 찾기
            await frame.waitForSelector('img[alt="닫기"]', { visible: true, timeout: 3000 });
            await frame.click('img[alt="닫기"]');
            console.log("✅ 팝업 '닫기' 이미지 클릭 완료");
            await new Promise(resolve => setTimeout(resolve, 1000)); // 팝업 닫힌 후 1초 대기
        } catch (error) {
            console.log("⚠️ 팝업 '닫기' 이미지가 나타나지 않았거나 이미 닫혀 있음");
        }

        try {
            console.log(`🧐 iframe URL: ${frame.url()}`);

            // iframe 내부의 모든 버튼 찾기
            const buttons = await frame.$$("button");

            console.log(`🔹 ${frame.url()} 내부 버튼 개수: ${buttons.length}개`);

            if (buttons.length > 0) {
                for (const button of buttons) {
                    const text = await frame.evaluate(el => el.innerText, button);
                    // console.log(`▶ 버튼 텍스트: ${text}`);

                    if (text.includes("전체메뉴")) {
                        console.log("✅ '전체메뉴' 버튼을 찾았습니다. 클릭합니다.");
                        await button.click();
                        buttonFound = true;
                        menuFrame = frame; // 전체메뉴가 열리는 iframe 저장
                        break;
                    }
                }
            }

            if (buttonFound) break;
        } catch (err) {
            console.log("❌ iframe 내부 버튼 확인 중 오류 발생:", err);
        }
    }

    if (!buttonFound) {
        console.log("❌ '전체메뉴' 버튼을 찾을 수 없습니다.");
        return;
    }

    // ✅ '전체메뉴'가 iframe 내부에서 열리는 경우, 해당 iframe에서 요소를 찾기
    let menuSelector = ".all_menu_infor";
    let menuElement = null;

    if (menuFrame) {
        try {
            menuElement = await menuFrame.waitForSelector(menuSelector, { timeout: 10000 });
        } catch (err) {
            console.log("❌ iframe 내부에서 '.all_menu_infor' 요소를 찾을 수 없습니다.");
        }
    } else {
        try {
            menuElement = await page.waitForSelector(menuSelector, { timeout: 10000 });
        } catch (err) {
            console.log("❌ '.all_menu_infor' 요소를 찾을 수 없습니다.");
        }
    }

    if (!menuElement) {
        console.log("❌ '전체메뉴'가 열리지 않았습니다.");
        return;
    }

    console.log("✅ 전체메뉴가 열렸습니다.");

    // ✅ 전체메뉴 스크롤 끝까지 내리기
    if (menuFrame) {
        await menuFrame.evaluate(() => {
            const menuBox = document.querySelector(".all_menu_infor");
            if (menuBox) {
                menuBox.scrollTop = menuBox.scrollHeight;
            }
        });
    } else {
        await page.evaluate(() => {
            const menuBox = document.querySelector(".all_menu_infor");
            if (menuBox) {
                menuBox.scrollTop = menuBox.scrollHeight;
            }
        });
    }
    console.log("✅ 전체메뉴 스크롤을 끝까지 내렸습니다.");

    // ✅ '조회/발급' 클릭
    let targetSelector = "a[href=\"javascript:goMenuByMenuID('0709');\"]";
    let targetMenu = null;

    if (menuFrame) {
        try {
            targetMenu = await menuFrame.waitForSelector(targetSelector, { timeout: 10000 });
        } catch (err) {
            console.log("❌ iframe 내부에서 '조회/발급' 메뉴를 찾을 수 없습니다.");
        }
    } else {
        try {
            targetMenu = await page.waitForSelector(targetSelector, { timeout: 10000 });
        } catch (err) {
            console.log("❌ '조회/발급' 메뉴를 찾을 수 없습니다.");
        }
    }

    if (targetMenu) {
        await targetMenu.click();
        console.log("✅ '조회/발급' 메뉴를 클릭했습니다.");
    } else {
        console.log("❌ '조회/발급' 메뉴를 찾을 수 없습니다.");
    }
    
    // 조회/발급 클릭 후 3초 대기 (iframe 로딩을 기다림)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const newFrames = await page.frames();
    console.log(`🔍 '조회/발급' 클릭 후 새로운 iframe 개수: ${newFrames.length}개`);

    let targetFrame = null;

    for (const frame of newFrames) {
        try {
            // iframe 내부의 <a> 요소 확인 (onclick 속성 포함)
            const targetElement = await frame.$("a.tab[onclick*='BldnStndAmtLstAction.view']");
            if (targetElement) {
                console.log(`✅ '주택외건물시가 표준액조회' 버튼이 포함된 iframe을 찾았습니다.`);
                targetFrame = frame;
                break;
            }
        } catch (err) {
            console.log(`⚠️ iframe 내부 요소 탐색 중 오류 발생: ${err.message}`);
        }
    }

    if (!targetFrame) {
        console.log("❌ '주택외건물시가 표준액조회' 버튼이 포함된 iframe을 찾을 수 없습니다.");
    } else {
        // ✅ iframe 내부에서 "주택외건물시가 표준액조회" 버튼 클릭
        const targetButton = await targetFrame.waitForSelector("a.tab[onclick*='BldnStndAmtLstAction.view']", { timeout: 10000 });

        if (targetButton) {
            await targetButton.click();
            console.log("✅ '주택외건물시가 표준액조회' 버튼을 클릭했습니다.");
        } else {
            console.log("❌ '주택외건물시가 표준액조회' 버튼을 찾을 수 없습니다.");
        }
    }

    // 1️⃣ 엑셀 파일 열기
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("data_address_updated.xlsx"); // 🔹 엑셀 파일 불러오기
    const worksheet = workbook.getWorksheet(1); // 🔹 첫 번째 시트 가져오기

    const rowCount = 9688; // 총 9688개의 행
    const savedData = {}; // 검색된 데이터 저장용
    let lastSearchKey = null; // 마지막 검색한 key 저장

    // 2️⃣ 엑셀에서 관할구청 가져오기
    for (let rowIndex = 2; rowIndex <= rowCount + 1; rowIndex++) {
        const row = worksheet.getRow(rowIndex); // 🔹 2번째 행 데이터 가져오기
        const districtName = row.getCell(2).value; // 🔹 '관할구청' 값 가져오기
        const legalAddress = row.getCell(3).value; // 🔹 '법정동' 값 가져오기
        const bonbun = row.getCell(5).value; // 🔹 '본번' 값 가져오기
        const bubun = row.getCell(6).value; // 🔹 '부번' 값 가져오기
        const floor = row.getCell(7).value; // 🔹 '층' 값 가져오기
        const area = row.getCell(17).value; // 🔹 '총면적' 값 가져오기
        const searchKey = `${districtName}_${legalAddress}_${bonbun}_${bubun}`;

        console.log(`🌟 ${rowIndex}번째 데이터 검색 시작`);

        // 🔹 이전 검색 조건과 같다면 새로 검색하지 않고 현재 테이블에서 시가표준액 검색
        if (searchKey === lastSearchKey) {
            console.log("🔹 동일한 검색 조건 감지! 현재 테이블에서 시가표준액 검색");
            buildingPrice = await findMatchingHo(floor, area, page);
        } else {
            console.log("🔍 새로운 검색 조건 감지! 웹에서 검색 수행");

            // 🔹 2024년을 선택 (한 번만 수행)
            if (rowIndex >= 2) {
                await selectYear(page, 2024);
                await new Promise(resolve => setTimeout(resolve, 3000)); 
                console.log("✅ 년도 선택 후 3초 대기 완료");
            }

            await selectDistrictAndLegalAddress(page, districtName, legalAddress);
            
            // 🔹 본번 및 부번 입력을 매번 실행하도록 변경
            await enterBonbunAndBubun(page, bonbun, bubun);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 🔹 조회 버튼 클릭 (새로운 검색 조건일 때만)
            await clickSearchButton(page);
            await new Promise(resolve => setTimeout(resolve, 3000));

            lastSearchKey = searchKey; // 검색 조건 업데이트
            buildingPrice = await findMatchingHo(floor, area, page);
        }

        const key = `${districtName}_${legalAddress}_${bonbun}_${bubun}_${floor}_${area}`;

        // 🔹 'savedData'에 기존 값이 있으면 덮어쓰지 않고 유지
        if (savedData[key]) {
            // 기존 값 사용
            row.getCell(8).value = savedData[key];
            console.log(`✅ 기존 저장된 값 사용: ${savedData[key]}`);
        } else {
            if (buildingPrice) {
                console.log("✅ 호수 및 면적 찾기 완료!");
                // 🔹 시가표준액을 엑셀 H열에 저장
                row.getCell(8).value = buildingPrice;
                savedData[key] = buildingPrice; // 검색된 값 저장
            } else {
                console.log("❌ 호수 및 면적 찾기 실패!");
            }
        }

        // 동일한 조건의 이전 값 갱신 (층수, 총면적도 동일해야 함)
        for (let j = 2; j < rowIndex; j++) {
            const prevRow = worksheet.getRow(j);
            const prevKey = `${prevRow.getCell(2).value}_${prevRow.getCell(3).value}_${prevRow.getCell(5).value}_${prevRow.getCell(6).value}_${prevRow.getCell(7).value}_${prevRow.getCell(17).value}`;

            if (savedData[prevKey] && savedData[prevKey] !== prevRow.getCell(8).value) {
                prevRow.getCell(8).value = savedData[prevKey];
                console.log(`📌 ${j}행 '시가표준' 값이 갱신되었습니다.`);
            }
        }

         // 매 반복마다 저장 (중간에 오류 발생해도 데이터 보존)
        await workbook.xlsx.writeFile("data_address_updated.xlsx");
        console.log(`🍒 시가표준액 저장: ${buildingPrice}`);

        // 🔹 일정 시간 대기
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 🔹 각 선택된 값과 입력 값을 초기화
        const selectElements = await page.$$('select'); // 모든 select 요소를 찾음
        for (const select of selectElements) {
            // 선택된 값을 초기화 (첫 번째 옵션으로 설정)
            await select.select(select.options[0].value);
        }

        const iframe = await page.waitForSelector('iframe');
        const frame = await iframe.contentFrame();

        if (frame) {
            // 🔹 input 요소 초기화
            await frame.evaluate(() => {
                document.querySelectorAll('input').forEach(input => input.value = '');
            });
        } else {
            console.log("❌ iframe을 찾을 수 없습니다.");
        }

        console.log("✅ 선택 및 입력 값 초기화 완료");
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    async function saveData() {
        await workbook.xlsx.writeFile("data_address_updated.xlsx");
        console.log(`🍒 시가표준액 저장: ${buildingPrice}`);
    }
    // 종료 시 데이터 백업
    process.on('SIGINT', async () => {
        console.log("⚠️ 프로그램 종료 감지됨. 데이터 백업 중...");
        await saveData();  // 현재 데이터 저장
        // 파일 복사 (백업)
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
        const backupFileName = `data_address_backup_${timestamp}.xlsx`;
        fs.copyFileSync("data_address_updated.xlsx", backupFileName);
        console.log(`✅ 데이터 백업 완료: ${backupFileName}`);
        process.exit();  // 종료
    });

    // 브라우저 창 닫기나 새로 고침 시에도 백업 처리
    window.onbeforeunload = async () => {
        console.log("⚠️ 페이지가 닫히거나 새로 고침됩니다. 데이터 백업 중...");
        await saveData();  // 현재 데이터 저장
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
        const backupFileName = `data_address_backup_${timestamp}.xlsx`;
        fs.copyFileSync("data_address_updated.xlsx", backupFileName);
        console.log(`✅ 데이터 백업 완료: ${backupFileName}`);
    };

    // 🔹 연도 선택 함수 (2024년을 선택)
    async function selectYear(page, year) {
        const iframe = await page.waitForSelector('iframe'); // iframe 요소 기다리기
        const frame = await iframe.contentFrame(); // iframe으로 전환
    
        const yearSelector = '#GWAPO_YEAR'; // 연도 셀렉트 박스의 ID
    
        // 셀렉트 박스에서 연도 선택 (value가 '2024'인 옵션 선택)
        await frame.select(yearSelector, year.toString()); // '2024' 값 선택
    
        console.log(`✅ '${year}'년 선택 완료`);
    };
    
    // 🔹 관할구청 선택 후 바로 법정동 선택하는 코드
    async function selectDistrictAndLegalAddress(page, districtName, legalAddress) {
        const districtCode = getDistrictCode(districtName);  // 관할구청 이름을 코드로 변환

        if (!districtCode) {
            console.log(`❌ '${districtName}'에 해당하는 값을 찾을 수 없습니다.`);
            return;
        }

        try {
            // iframe이 존재하는지 확인하고, iframe으로 전환
            const iframe = await page.waitForSelector('iframe', { timeout: 5000 });
            const frame = await iframe.contentFrame();  // iframe 내로 전환
    
            // 관할구청 선택 (select 요소)
            const districtSelector = '#SIGU_CD';  // 관할구청 셀렉트 박스의 ID
    
            // 셀렉터가 제대로 로드될 때까지 대기
            const selectBox = await frame.waitForSelector(districtSelector, { timeout: 5000 });
    
            if (selectBox) {
                // 관할구청 코드로 선택
                await selectBox.select(districtCode);
                console.log(`✅ '${districtName}'(${districtCode}) 선택 완료`);
    
                // 3초 대기 대신 해당 법정동 셀렉터가 로드될 때까지 기다림
                const legalAddressSelector = `select[name="HDONG${districtCode}"]`;  // 법정동 select 요소의 id를 동적으로 생성
    
                // 법정동 select 박스가 로드될 때까지 대기
                await frame.waitForSelector(legalAddressSelector, { timeout: 5000 });
                const legalAddressSelectBox = await frame.$(legalAddressSelector);
    
                if (legalAddressSelectBox) {
                    const legalAddressCode = getLegalAddressCode(legalAddress);  // 법정동 코드를 가져옵니다.
    
                    if (legalAddressCode) {
                        await legalAddressSelectBox.select(legalAddressCode);  // 법정동 코드로 선택
                        console.log(`✅ '${legalAddress}'(${legalAddressCode}) 선택 완료`);
                    } else {
                        console.log(`❌ '${legalAddress}'에 해당하는 법정동 코드를 찾을 수 없습니다.`);
                    }
                } else {
                    console.log(`❌ 법정동 셀렉터 '#${legalAddressSelector}'를 찾을 수 없습니다.`);
                }
            }
        } catch (error) {
            console.log(`❌ 관할구청 셀렉터를 찾을 수 없습니다: ${error.message}`);
        }
    }

    // 🔹 본번과 부번 입력 함수 (id 사용)
    async function enterBonbunAndBubun(page, bonbun, bubun) {
        const iframe = await page.waitForSelector('iframe'); // iframe 요소 기다리기
        const frame = await iframe.contentFrame(); // iframe으로 전환

        // 본번 입력
        const bonbunInput = await frame.$('#bonbun'); // id="bonbun"으로 선택
        if (bonbunInput) {
            await bonbunInput.type(bonbun);  // 본번 입력
            console.log(`✅ 본번 '${bonbun}' 입력 완료`);
        } else {
            console.log("❌ 본번 입력 필드를 찾을 수 없습니다.");
        }

        // 부번 입력
        const bubunInput = await frame.$('#bubun'); // id="bubun"으로 선택
        if (bubunInput) {
            await bubunInput.type(bubun);  // 부번 입력
            console.log(`✅ 부번 '${bubun}' 입력 완료`);
        } else {
            console.log("❌ 부번 입력 필드를 찾을 수 없습니다.");
        }
    }

    // 🔹 조회하기 버튼 클릭 함수
    async function clickSearchButton(page) {
        const iframe = await page.waitForSelector('iframe'); // iframe 요소 기다리기
        const frame = await iframe.contentFrame(); // iframe으로 전환

        // '조회' 버튼 선택
        const searchButton = await frame.$('button.black[onclick="searchB();"]'); // 조회 버튼 선택
        if (searchButton) {
            await searchButton.click();  // 조회 버튼 클릭
            console.log("✅ '조회' 버튼을 클릭했습니다.");
        } else {
            console.log("❌ '조회' 버튼을 찾을 수 없습니다.");
        }
    }

    async function getFrame(page) {
        const iframeElement = await page.waitForSelector('iframe', { timeout: 5000 }).catch(() => null);
        if (!iframeElement) {
            console.log("❌ iframe을 찾을 수 없습니다.");
            return null;
        }
    
        let frame;
        try {
            frame = await iframeElement.contentFrame();
        } catch (err) {
            console.log("❌ iframe 내부 접근 실패", err.message);
            return null;
        }
    
        if (!frame) {
            console.log("❌ iframe 내부에 접근할 수 없습니다.");
            return null;
        }
        return frame;
    }

    // 🔹 호수를 찾는 함수
    async function findMatchingHo(specificFloor, totalArea, page) {
        let frame = await getFrame(page);
        if (!frame) {
            console.log("❌ 유효한 iframe이 없습니다.");
            return null;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
            // 🔹 테이블이 존재하는지 확인
            await frame.waitForSelector('.result_wrap table', { timeout: 10000 }).catch(() => null);
            const resultTable = await frame.$('.result_wrap table');

            if (!resultTable) {
                console.log("❌ 'result_wrap' 테이블이 존재하지 않습니다.");
                return null;
            }
            console.log("✅ 'result_wrap' 테이블을 찾았습니다.");

            let rows = await resultTable.$$('tr');
            if (!rows || rows.length === 0) {
                console.log("❌ 테이블에 행이 없습니다.");
                return null;
            }

            const floorPattern = specificFloor.toString().padStart(3, '0');
            let currentFloor = null;

            for (const rowHandle of rows) {
                try {
                    // 🔹 해당 행이 여전히 DOM에 존재하는지 확인
                    const isConnected = await rowHandle.evaluate(el => el.ownerDocument.contains(el));
                    if (!isConnected) {
                        console.log("⚠️ 해당 행이 DOM에서 삭제되었습니다.");
                        continue; // 해당 행이 DOM에서 제거된 경우 skip
                    }

                    const cells = await rowHandle.$$('td');
                    if (cells.length < 9) continue; // 최소한 9개의 셀이 있어야 함

                    const hoText = await cells[4].evaluate(el => el.textContent.trim());
                    let areaText = await cells[8].evaluate(el => el.textContent.trim());
                    areaText = areaText.replace(/[^\d.-]/g, '');

                    if (hoText.startsWith(floorPattern)) {
                        console.log(`✅ '${floorPattern}'에 해당하는 호수 ${hoText} 찾음`);

                        const currentRowFloor = hoText.substring(0, 3);
                        if (currentFloor !== currentRowFloor) {
                            if (currentFloor !== null) {
                                console.log(`🔴 층이 변경되어 검색을 종료합니다.`);
                                return null;
                            }
                            currentFloor = currentRowFloor;
                        }

                        // 🔹 총면적을 소수점 셋째 자리에서 반올림하여 비교
                        totalArea = parseFloat(totalArea);
                        totalArea = Math.round(totalArea * 100) / 100; // 소수점 셋째 자리에서 반올림
                        console.log(`📝 반올림된 엑셀 총면적: ${totalArea}`);

                        areaText = parseFloat(areaText);

                        // 🔹 오차가 0.01 이내인지 확인
                        if (Math.abs(totalArea - areaText) <= 0.01) {
                            console.log(`🎯 연면적(${areaText})과 반올림된 총면적(${totalArea})이 0.01 이내로 일치!`);

                            const nextRowHandle = await rowHandle.evaluateHandle(el => el.nextElementSibling).catch(() => null);
                            if (!nextRowHandle || !(await nextRowHandle.evaluate(el => el.ownerDocument.contains(el)))) {
                                console.log("❌ 다음 행을 찾을 수 없습니다.");
                                return null;
                            }

                            const buildingPriceCell = await nextRowHandle.$('td:nth-child(2)').catch(() => null);
                            if (buildingPriceCell) {
                                const buildingPriceText = await buildingPriceCell.evaluate(el => el.textContent.trim());
                                console.log(`▶ 건축물 시가표준액: ${buildingPriceText}`);
                                return buildingPriceText;
                            } else {
                                console.log("❌ 건축물 시가표준액의 두 번째 값을 찾을 수 없습니다.");
                                return null;
                            }
                        }
                    }
                } catch (err) {
                    console.log(`⚠️ 행 처리 중 오류 발생: ${err.message}`);
                }
            }
        } catch (err) {
            console.log(`❌ findMatchingHo 실행 중 오류 발생: ${err.message}`);
        }

        console.log("❌ 해당 호수를 찾을 수 없습니다.");
        return null;
    }
})();

// 🔹 관할구청을 코드로 변환하는 함수
function getDistrictCode(name) {
    const districts = {
        '강남구': '680',
        '강동구': '740',
        '강북구': '305',
        '강서구': '500',
        '관악구': '620',
        '광진구': '215',
        '구로구': '530',
        '금천구': '545',
        '노원구': '350',
        '도봉구': '320',
        '동대문구': '230',
        '동작구': '590',
        '마포구': '440',
        '서대문구': '410',
        '서초구': '650',
        '성동구': '200',
        '성북구': '290',
        '송파구': '710',
        '양천구': '470',
        '영등포구': '560',
        '용산구': '170',
        '은평구': '380',
        '종로구': '110',
        '중구': '140',
        '중랑구': '260'
    };
    return districts[name] || ''; // 기본적으로 값이 없으면 빈 문자열 반환
}


// 🔹 법정동을 코드로 변환하는 함수
function getLegalAddressCode(name) {
    const legalAddresses = {
        // 강남구
        '개포동': '10300',
        '논현동': '10800',
        '대치동': '10600',
        '도곡동': '11800',
        '삼성동': '10500',
        '세곡동': '11100',
        '수서동': '11500',
        '신사동': '10700',
        '압구정동': '11000',
        '역삼동': '10100',
        '율현동': '11300',
        '일원동': '11400',
        '자곡동': '11200',
        '청담동': '10400',
        '포이동': '10200',
        // 강동구
        '강일동': '11000',
        '고덕동': '10200',
        '길동': '10500',
        '둔촌동': '10600',
        '명일동': '10100',
        '상일동': '10300',
        '성내동': '10800',
        '암사동': '10700',
        '천호동': '10900',
        '하일동': '10400',
        // 강북구
        "미아동": "10100",
        "번동": "10200",
        "수유동": "10300",
        "우이동": "10400",
        // 관악구
        "남현동": "10300",
        "봉천동": "10100",
        "신림동": "10200",
        // 강서구
        "가양동": "10400",
        "개화동": "11000",
        "공항동": "10800",
        "과해동": "11100",
        "내발산동": "10600",
        "등촌동": "10200",
        "마곡동": "10500",
        "방화동": "10900",
        "염창동": "10100",
        "오곡동": "11200",
        "오쇠동": "11300",
        "외발산동": "10700",
        "화곡동": "10300",
        // 광진구
        "광장동": "10400",
        "구의동": "10300",
        "군자동": "10900",
        "노유동": "10600",
        "능동": "10200",
        "모진동": "10800",
        "자양동": "10500",
        "중곡동": "10100",
        "화양동": "10700",

        // 구로구
        "가리봉동": "10300",
        "개봉동": "10700",
        "고척동": "10600",
        "구로동": "10200",
        "궁동": "10900",
        "신도림동": "10100",
        "오류동": "10800",
        "온수동": "11000",
        "천왕동": "11100",
        "항동": "11200",
        // 금천구
        "가산동": "10100",
        "독산동": "10200",
        "시흥동": "10300",
        // 노원구
        "공릉동": "10300",
        "상계동": "10500",
        "월계동": "10200",
        "중계동": "10600",
        "하계동": "10400",
        // 도봉구
        "도봉동": "10800",
        "방학동": "10600",
        "쌍문동": "10500",
        "창동": "10700",
        // 동대문구
        "답십리동": "10500",
        "신설동": "10100",
        "용두동": "10200",
        "이문동": "11000",
        "장안동": "10600",
        "전농동": "10400",
        "제기동": "10300",
        "청량리동": "10700",
        "회기동": "10800",
        "휘경동": "10900",
        // 동작구
        "노량진동": "10100",
        "대방동": "10800",
        "동작동": "10600",
        "본동": "10400",
        "사당동": "10700",
        "상도1동": "10300",
        "상도동": "10200",
        "신대방동": "10900",
        "흑석동": "10500",
        // 마포구
        "공덕동": "10200",
        "구수동": "11300",
        "노고산동": "11000",
        "당인동": "11800",
        "대흥동": "10800",
        "도화동": "10400",
        "동교동": "12100",
        "마포동": "10700",
        "망원동": "12300",
        "상수동": "11500",
        "상암동": "12700",
        "서교동": "12000",
        "성산동": "12500",
        "신공덕동": "10300",
        "신수동": "11100",
        "신정동": "11700",
        "아현동": "10100",
        "연남동": "12400",
        "염리동": "10900",
        "용강동": "10500",
        "중동": "12600",
        "창전동": "11400",
        "토정동": "10600",
        "하중동": "11600",
        "합정동": "12200",
        "현석동": "11200",
        // 서대문구
        "남가좌동": "12000",
        "냉천동": "10500",
        "대신동": "11300",
        "대현동": "11200",
        "미근동": "10400",
        "봉원동": "11500",
        "북가좌동": "11900",
        "북아현동": "11000",
        "신촌동": "11400",
        "연희동": "11700",
        "영천동": "10800",
        "옥천동": "10700",
        "창천동": "11600",
        "천연동": "10600",
        "충정로2가": "10100",
        "충정로3가": "10200",
        "합동": "10300",
        "현저동": "10900",
        "홍은동": "11800",
        "홍제동": "11100",
        // 서초구
        "내곡동": "10900",
        "반포동": "10700",
        "방배동": "10100",
        "서초동": "10800",
        "신원동": "11100",
        "양재동": "10200",
        "염곡동": "11000",
        "우면동": "10300",
        "원지동": "10400",
        "잠원동": "10600",
        // 성동구
        "금호동1가": "10900",
        "금호동2가": "11000",
        "금호동3가": "11100",
        "금호동4가": "11200",
        "도선동": "10400",
        "마장동": "10500",
        "사근동": "10600",
        "상왕십리동": "10100",
        "성수동1가": "11400",
        "성수동2가": "11500",
        "송정동": "11800",
        "옥수동": "11300",
        "용답동": "12200",
        "응봉동": "10800",
        "하왕십리동": "10200",
        "행당동": "10700",
        "홍익동": "10300",
        // 성북구
        "길음동": "13400",
        "돈암동": "10300",
        "동선동1가": "11600",
        "동선동2가": "11700",
        "동선동3가": "11800",
        "동선동4가": "11900",
        "동선동5가": "12000",
        "동소문동1가": "10400",
        "동소문동2가": "10500",
        "동소문동3가": "10600",
        "동소문동4가": "10700",
        "동소문동5가": "10800",
        "동소문동6가": "10900",
        "동소문동7가": "11000",
        "보문동1가": "13000",
        "보문동2가": "13100",
        "보문동3가": "13200",
        "보문동4가": "12600",
        "보문동5가": "12700",
        "보문동6가": "12800",
        "보문동7가": "12900",
        "삼선동1가": "11100",
        "삼선동2가": "11200",
        "삼선동3가": "11300",
        "삼선동4가": "11400",
        "삼선동5가": "11500",
        "상월곡동": "13700",
        "석관동": "13900",
        "성북동": "10100",
        "성북동1가": "10200",
        "안암동1가": "12100",
        "안암동2가": "12200",
        "안암동3가": "12300",
        "안암동4가": "12400",
        "안암동5가": "12500",
        "장위동": "13800",
        "정릉동": "13300",
        "종암동": "13500",
        "하월곡동": "13600",
        // 송파구
        "가락동": "10700",
        "거여동": "11300",
        "마천동": "11400",
        "문정동": "10800",
        "방이동": "11100",
        "삼전동": "10600",
        "석촌동": "10500",
        "송파동": "10400",
        "신천동": "10200",
        "오금동": "11200",
        "잠실동": "10100",
        "장지동": "10900",
        "풍납동": "10300",
        // 양천구
        "목동": "10200",
        "신월동": "10300",
        "신정동": "10100",
        // 영등포구
        "당산동": "11700",
        "당산동1가": "11100",
        "당산동2가": "11200",
        "당산동3가": "11300",
        "당산동4가": "11400",
        "당산동5가": "11500",
        "당산동6가": "11600",
        "대림동": "13300",
        "도림동": "11800",
        "문래동1가": "11900",
        "문래동2가": "12000",
        "문래동3가": "12100",
        "문래동4가": "12200",
        "문래동5가": "12300",
        "문래동6가": "12400",
        "신길동": "13200",
        "양평동": "13400",
        "양평동1가": "12500",
        "양평동2가": "12600",
        "양평동3가": "12700",
        "양평동4가": "12800",
        "양평동5가": "12900",
        "양평동6가": "13000",
        "양화동": "13100",
        "여의도동": "11000",
        "영등포동": "10100",
        "영등포동1가": "10200",
        "영등포동2가": "10300",
        "영등포동3가": "10400",
        "영등포동4가": "10500",
        "영등포동5가": "10600",
        "영등포동6가": "10700",
        "영등포동7가": "10800",
        "영등포동8가": "10900",
        // 용산구
        "갈월동": "10400",
        "남영동": "10500",
        "도원동": "12000",
        "동빙고동": "13200",
        "동자동": "10700",
        "문배동": "12200",
        "보광동": "13600",
        "산천동": "11500",
        "서계동": "10800",
        "서빙고동": "13300",
        "신계동": "12300",
        "신창동": "11400",
        "용문동": "12100",
        "용산동1가": "10600",
        "용산동2가": "10200",
        "용산동3가": "12600",
        "용산동4가": "10300",
        "용산동5가": "12700",
        "용산동6가": "13500",
        "원효로1가": "11200",
        "원효로2가": "11300",
        "원효로3가": "11700",
        "원효로4가": "11800",
        "이촌동": "12900",
        "이태원동": "13000",
        "주성동": "13400",
        "청암동": "11600",
        "청파동1가": "10900",
        "청파동2가": "11000",
        "청파동3가": "11100",
        "한강로1가": "12400",
        "한강로2가": "12500",
        "한강로3가": "12800",
        "한남동": "13100",
        "효창동": "11900",
        "후암동": "10100",
        // 은평구
        "갈현동": "10400",
        "구산동": "10500",
        "구파발동": "11200",
        "녹번동": "10200",
        "대조동": "10600",
        "불광동": "10300",
        "수색동": "10100",
        "신사동": "10900",
        "역촌동": "10800",
        "응암동": "10700",
        "증산동": "11000",
        "진관내동": "11100",
        "진관동": "11400",
        "진관외동": "11300",
        // 종로구
        '가회동': '14600',
        '견지동': '12900',
        '경운동': '13400',
        '계동': '14800',
        '공평동': '12700',
        '관수동': '15500',
        '관철동': '13500',
        '관훈동': '12800',
        '교남동': '17600',
        '교북동': '18000',
        '구기동': '18200',
        '궁정동': '10300',
        '권농동': '13100',
        '낙원동': '13700',
        '내수동': '11800',
        '내자동': '11400',
        '누상동': '10900',
        '누하동': '11000',
        '당주동': '11700',
        '도렴동': '11600',
        '돈의동': '15300',
        '동숭동': '16800',
        '명륜1가': '17000',
        '명륜2가': '17100',
        '명륜3가': '17300',
        '명륜4가': '17200',
        '묘동': '15100',
        '무악동': '18700',
        '봉익동': '15200',
        '부암동': '18400',
        '사간동': '14400',
        '사직동': '11500',
        '삼청동': '14000',
        '서린동': '12300',
        '세종로': '11900',
        '소격동': '14200',
        '송월동': '17800',
        '송현동': '14500',
        '수송동': '12400',
        '숭인동': '17500',
        '신교동': '10200',
        '신문로1가': '12000',
        '신문로2가': '12100',
        '신영동': '18600',
        '안국동': '14100',
        '연건동': '16600',
        '연지동': '16000',
        '예지동': '15800',
        '옥인동': '11100',
        '와룡동': '13000',
        '운니동': '13200',
        '원남동': '15900',
        '원서동': '14900',
        '이화동': '16500',
        '익선동': '13300',
        '인사동': '13600',
        '인의동': '15700',
        '장사동': '15400',
        '재동': '14700',
        '적선동': '10700',
        '종로1가': '12600',
        '종로2가': '13800',
        '종로3가': '15600',
        '종로4가': '16100',
        '종로5가': '16300',
        '종로6가': '16400',
        '중학동': '12500',
        '창성동': '10500',
        '창신동': '17400',
        '청운동': '10100',
        '청진동': '12200',
        '체부동': '11200',
        '충신동': '16700',
        '통의동': '10600',
        '통인동': '10800',
        '팔판동': '13900',
        '평동': '17700',
        '평창동': '18300',
        '필운동': '11300',
        '행촌동': '18100',
        '혜화동': '16900',
        '홍지동': '18500',
        '홍파동': '17900',
        '화동': '14300',
        '효자동': '10400',
        '효제동': '16200',
        '훈정동': '15000',
        // 중구
        "광희동1가": "14500",
        "광희동2가": "14600",
        "남대문로1가": "10600",
        "남대문로2가": "11500",
        "남대문로3가": "11600",
        "남대문로4가": "11700",
        "남대문로5가": "11800",
        "남산동1가": "12800",
        "남산동2가": "12900",
        "남산동3가": "13000",
        "남창동": "11200",
        "남학동": "14000",
        "다동": "10200",
        "만리동1가": "17300",
        "만리동2가": "17400",
        "명동1가": "12600",
        "명동2가": "12700",
        "무교동": "10100",
        "무학동": "16400",
        "묵정동": "13600",
        "방산동": "15300",
        "봉래동1가": "11900",
        "봉래동2가": "12000",
        "북창동": "11300",
        "산림동": "15700",
        "삼각동": "10700",
        "서소문동": "16600",
        "소공동": "11100",
        "수표동": "11000",
        "수하동": "10800",
        "순화동": "16800",
        "신당동": "16200",
        "쌍림동": "14700",
        "예관동": "13500",
        "예장동": "14200",
        "오장동": "15400",
        "을지로1가": "10400",
        "을지로2가": "10500",
        "을지로3가": "15500",
        "을지로4가": "15000",
        "을지로5가": "15100",
        "을지로6가": "14800",
        "을지로7가": "14900",
        "의주로1가": "16900",
        "의주로2가": "17200",
        "인현동1가": "16000",
        "인현동2가": "13400",
        "입정동": "15600",
        "장교동": "10900",
        "장충동1가": "14300",
        "장충동2가": "14400",
        "저동1가": "13100",
        "저동2가": "16100",
        "정동": "16700",
        "주교동": "15200",
        "주자동": "14100",
        "중림동": "17100",
        "초동": "15900",
        "충무로1가": "12400",
        "충무로2가": "12500",
        "충무로3가": "15800",
        "충무로4가": "13200",
        "충무로5가": "13300",
        "충정로1가": "17000",
        "태평로1가": "10300",
        "태평로2가": "11400",
        "필동1가": "13700",
        "필동2가": "13800",
        "필동3가": "13900",
        "황학동": "16500",
        "회현동1가": "12100",
        "회현동2가": "12200",
        "회현동3가": "12300",
        "흥인동": "16300",
        // 중랑구
        "망우동": "10500",
        "면목동": "10100",
        "묵동": "10400",
        "상봉동": "10200",
        "신내동": "10600",
        "중화동": "10300"
    };
    return legalAddresses[name] || '';  // 해당하는 법정동 코드 반환, 없으면 빈 문자열 반환
}
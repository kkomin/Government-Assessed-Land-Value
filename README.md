# Government Assessed Land Value
## extract-data.js
- 서울 부동산 정보 조회시스템에서 2024년의 개별공시지가 데이터 추출
- 검색 조건 : 관할구청, 법정동, 본번, 부번
- 필터 조건 : 개별공시지가 탭, 2024년도
- https://kras.seoul.go.kr/land_info/info/baseInfo/baseInfo.do?service=baseInfo&landcode=1111010700101560000&gblDivName=baseInfo&scale=0&gyujae=0&label_type=false#t05-tab


## architecture.js
- 서울시 ETAX에서 2024년 건축물 시가표준액 데이터 추출
- 검색 조건 : 관할구청, 법정동, 본번, 부번
- 필터 조건 : 연도, 층, 총면적 (소수점에서 반올림, 오차 0.01 허용)
- https://etax.seoul.go.kr/index.html?20250205


## changecsv.py
- csv 파일을 excel 파일로 변경

---

[🌟 참고사항]
- 검색을 진행하거나 변경하고 싶은 경우, 데이터 파일을 폴더에 첨부해서 이용 추천
- 엑셀 파일에 저장되는 형식을 주의해서 변경 후 이용 추천
- 해당 데이터는 다음과 같은 구조의 데이터 파일을 이용했음.
  ![image](https://github.com/user-attachments/assets/5784d158-5229-4cd6-9b94-e5e60f7aae9d)


## 📁 사용한 라이브러리
- puppeteer: 24.2.0
- xlsm : 0.18.5
- exceljs : 0.18.5

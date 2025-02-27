import pandas as pd

# CSV 파일 불러오기
input_file = "input.csv"
df = pd.read_csv(input_file, delimiter="|", dtype=str, encoding="cp949")

# '법정동명'을 '시도명'과 '법정동명'으로 분리
df["시도명"] = df["법정동명"].apply(lambda x: x.split(" ", 1)[0] if pd.notna(x) else "")
df["법정동명"] = df["법정동명"].apply(lambda x: x.split(" ", 1)[1] if " " in x else "")

# '대지권비율'에서 분자 값만 추출하고 소수점 둘째 자리까지 반올림 (비어 있으면 0)
def extract_and_round(value):
    if pd.notna(value):  # 값이 비어있지 않다면
        # "/" 앞의 값을 추출하고, 소수점 둘째 자리까지 반올림
        try:
            numerator = float(value.split("/")[0].strip())  # 분자 추출
            return round(numerator, 2)  # 소수점 둘째 자리까지 반올림
        except ValueError:
            return 0
    else:
        return 0  # 값이 비어 있으면 0

df["대지권비율"] = df["대지권비율"].apply(extract_and_round)

# 필요한 컬럼만 선택 (법정동코드 추가)
columns_to_extract = ["법정동코드", "시도명", "법정동명", "지번", "대지권비율"]
df_selected = df[columns_to_extract]

# 최대 행 개수 설정 (엑셀 시트당 최대 1,000,000개 행)
max_rows = 1_000_000

output_file = "output.xlsx"

# 데이터를 나누어 저장
with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
    for i, start in enumerate(range(0, len(df_selected), max_rows)):
        df_selected.iloc[start:start + max_rows].to_excel(writer, sheet_name=f"Sheet_{i+1}", index=False)
        print(f"Sheet_{i+1} 저장 완료!")

print(f"모든 데이터가 {output_file} 파일의 여러 시트로 저장되었습니다.")

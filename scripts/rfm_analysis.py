import os
import json
import pandas as pd
import numpy as np
from datetime import datetime

def assign_segment(r, f, m):
    # Standard RFM Business Logic Mapping
    if r >= 4 and f >= 4 and m >= 4:
        return "Champions"
    elif r >= 3 and f >= 3 and m >= 3:
        return "Loyal Customers"
    elif r >= 4 and f >= 2 and m >= 2:
        return "Potential Loyalists"
    elif r >= 4 and f == 1:
        return "New Customers"
    elif r <= 2 and f >= 4 and m >= 4:
        return "Cannot Lose Them"
    elif r <= 2 and f >= 3 and m >= 3:
        return "At-Risk"
    elif r <= 2 and f <= 2 and m <= 2:
        return "Hibernating/Lost"
    elif r >= 3 and f <= 2:
        return "Promising/Need Attention"
    else:
        return "About to Sleep"

def main():
    print("Starting RFM Analysis...")
    
    # 1. Load Data
    raw_path = "data/raw_customer_transactions.csv"
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Raw transaction file not found at {raw_path}. Run generate_raw_data.py first.")
        
    df = pd.read_csv(raw_path)
    print(f"Loaded {len(df)} customer records.")
    
    # 2. Date conversions and Recency calculation
    analysis_date = datetime(2026, 6, 13)
    df['Customer Join Date'] = pd.to_datetime(df['Customer Join Date'])
    df['Last Purchase Date'] = pd.to_datetime(df['Last Purchase Date'])
    
    # Recency in days
    df['Recency (Days)'] = (analysis_date - df['Last Purchase Date']).dt.days
    
    # 3. Calculate Scores (1 to 5) based on realistic business thresholds
    # Recency (Days): 1-30 -> 5, 31-75 -> 4, 76-180 -> 3, 181-365 -> 2, 365+ -> 1
    def get_recency_score(days):
        if days <= 30: return 5
        elif days <= 75: return 4
        elif days <= 180: return 3
        elif days <= 365: return 2
        else: return 1

    df['Recency Score'] = df['Recency (Days)'].apply(get_recency_score)

    # Frequency (Orders): 1 -> 1, 2 -> 2, 3-5 -> 3, 6-12 -> 4, 13+ -> 5
    def get_frequency_score(orders):
        if orders == 1: return 1
        elif orders == 2: return 2
        elif orders <= 5: return 3
        elif orders <= 12: return 4
        else: return 5

    df['Frequency Score'] = df['Total Orders'].apply(get_frequency_score)

    # Monetary (Spend): <100 -> 1, 100-299 -> 2, 300-799 -> 3, 800-2499 -> 4, 2500+ -> 5
    def get_monetary_score(spend):
        if spend < 100: return 1
        elif spend < 300: return 2
        elif spend < 800: return 3
        elif spend < 2500: return 4
        else: return 5

    df['Monetary Score'] = df['Total Purchase Amount'].apply(get_monetary_score)
    
    # Combined Metrics
    df['RFM Cell'] = df['Recency Score'].astype(str) + df['Frequency Score'].astype(str) + df['Monetary Score'].astype(str)
    df['RFM Score'] = df['Recency Score'] + df['Frequency Score'] + df['Monetary Score']
    
    # 4. Assign Segments
    df['Customer Segment'] = df.apply(lambda row: assign_segment(
        row['Recency Score'], 
        row['Frequency Score'], 
        row['Monetary Score']
    ), axis=1)
    
    # Save processed CSV for portfolios / databases
    processed_path = "data/customer_rfm_segmented.csv"
    print(f"Saving processed dataset with RFM details to {processed_path}...")
    df.to_csv(processed_path, index=False)
    
    # 5. Export full processed rows for in-memory JS processing
    print("Compiling customer database for web dashboard...")
    customers_list = []
    
    for _, r in df.iterrows():
        customers_list.append([
            r['Customer ID'],
            r['Customer Name'].split(" (")[0],
            r['Region'],
            r['Age Group'],
            int(r['Total Orders']),
            float(r['Total Purchase Amount']),
            int(r['Recency (Days)']),
            r['Product Category Preference'],
            r['Loyalty Status'],
            r['Customer Segment']
        ])
        
    dashboard_data = {
        "customers": customers_list
    }
    
    # Write to docs/data/dashboard_data.js
    js_path = "docs/data/dashboard_data.js"
    print(f"Writing database file to {js_path}...")
    with open(js_path, "w", encoding='utf-8') as f:
        f.write("// Pre-aggregated database generated from Python RFM analysis\n")
        f.write("window.dashboardData = ")
        json.dump(dashboard_data, f)
        f.write(";\n")
        
    print("RFM Analysis and database compilation completed successfully!")

if __name__ == "__main__":
    main()

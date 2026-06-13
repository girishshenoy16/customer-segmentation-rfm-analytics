import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def main():
    print("Starting raw data generation...")
    
    # Set seed for reproducibility
    np.random.seed(42)
    random.seed(42)
    
    num_customers = 105000
    
    # 1. Generate Directories
    os.makedirs("data", exist_ok=True)
    os.makedirs("scripts", exist_ok=True)
    os.makedirs("docs/data", exist_ok=True)
    os.makedirs("visualizations", exist_ok=True)
    os.makedirs("reports", exist_ok=True)
    
    # 2. Name lists to generate unique names
    first_names = [
        "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
        "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua",
        "Kenneth", "Kevin", "Brian", "George", "Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan",
        "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon",
        "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen",
        "Nancy", "Lisa", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna", "Michelle",
        "Dorothy", "Carol", "Amanda", "Melissa", "Deborah", "Stephanie", "Rebecca", "Sharon", "Laura", "Cynthia"
    ]
    
    last_names = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
        "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
        "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
        "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
        "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"
    ]
    
    regions = ["East", "West", "North", "South"]
    region_weights = [0.35, 0.25, 0.20, 0.20] # East has highest, then West
    
    age_groups = ["18-24", "25-34", "35-44", "45-54", "55+"]
    age_weights = [0.15, 0.35, 0.28, 0.14, 0.08] # 25-34 is dominant
    
    genders = ["Male", "Female", "Non-binary"]
    gender_weights = [0.48, 0.48, 0.04]
    
    product_categories = ["Electronics", "Apparel", "Home & Kitchen", "Beauty", "Sports"]
    category_weights = [0.25, 0.35, 0.20, 0.12, 0.08] # Apparel and Electronics dominant
    
    print("Generating unique names...")
    # Generate unique names
    unique_names = set()
    while len(unique_names) < num_customers:
        fn = random.choice(first_names)
        ln = random.choice(last_names)
        mi = chr(random.randint(65, 90)) # A-Z
        # Combine name with index to guarantee uniqueness at 105k
        idx = len(unique_names) + 1
        name = f"{fn} {mi}. {ln} ({idx})"
        unique_names.add(name)
    
    customer_names = list(unique_names)
    
    # Define reference dates
    analysis_date = datetime(2026, 6, 13)
    
    # Create arrays for columns
    cust_ids = [f"CUST-{i:06d}" for i in range(1, num_customers + 1)]
    cust_regions = np.random.choice(regions, size=num_customers, p=region_weights)
    cust_ages = np.random.choice(age_groups, size=num_customers, p=age_weights)
    cust_genders = np.random.choice(genders, size=num_customers, p=gender_weights)
    cust_categories = np.random.choice(product_categories, size=num_customers, p=category_weights)
    
    join_dates = []
    last_purchase_dates = []
    total_orders = []
    total_spend = []
    loyalty_statuses = []
    
    # We define 7 customer behavior profiles to generate realistic distributions
    # Profiles: Champions, Loyal Spenders, Potential Loyalists, New Customers, At Risk, Can't Lose Them, Hibernating
    profile_choices = [
        "Champions", "Loyal Spenders", "Potential Loyalists", 
        "New Customers", "At Risk", "Can't Lose Them", "Hibernating"
    ]
    profile_p = [0.10, 0.20, 0.15, 0.15, 0.15, 0.05, 0.20]
    
    cust_profiles = np.random.choice(profile_choices, size=num_customers, p=profile_p)
    
    print("Simulating customer behavior fields...")
    for i in range(num_customers):
        profile = cust_profiles[i]
        
        # 1. Join Date (anywhere between Jan 2024 and Dec 2025)
        days_back_join = random.randint(180, 890) # roughly 6 months to 2.5 years back
        join_date = analysis_date - timedelta(days=days_back_join)
        join_dates.append(join_date.strftime("%Y-%m-%d"))
        
        # 2. Recency, Frequency, Spend based on Profile
        if profile == "Champions":
            # Bought recently, buy frequently, spend a lot
            recency_days = random.randint(1, 30)
            orders = random.randint(15, 45)
            avg_order_value = random.uniform(80, 250)
            
        elif profile == "Loyal Spenders":
            # Bought relatively recently, high frequency, average spend
            recency_days = random.randint(15, 90)
            orders = random.randint(8, 25)
            avg_order_value = random.uniform(50, 180)
            
        elif profile == "Potential Loyalists":
            # Bought recently, low-to-medium frequency
            recency_days = random.randint(1, 45)
            orders = random.randint(2, 5)
            avg_order_value = random.uniform(40, 150)
            
        elif profile == "New Customers":
            # Bought very recently, only 1 order
            recency_days = random.randint(1, 20)
            orders = 1
            avg_order_value = random.uniform(25, 120)
            # Adjust join date to be close to purchase date
            join_date = analysis_date - timedelta(days=recency_days + random.randint(0, 5))
            join_dates[-1] = join_date.strftime("%Y-%m-%d")
            
        elif profile == "At Risk":
            # Spent big and frequent in past, but haven't purchased in a while
            recency_days = random.randint(120, 300)
            orders = random.randint(6, 20)
            avg_order_value = random.uniform(70, 200)
            
        elif profile == "Can't Lose Them":
            # Past heavy buyers, inactive for a long time
            recency_days = random.randint(250, 450)
            orders = random.randint(12, 35)
            avg_order_value = random.uniform(100, 300)
            
        else: # Hibernating (Low recency, low frequency, low spend)
            recency_days = random.randint(180, 540)
            # 50% 1 order, 35% 2 orders, 15% 3 orders to increase one-time buyers
            orders = random.choices([1, 2, 3], weights=[0.50, 0.35, 0.15])[0]
            avg_order_value = random.uniform(15, 60)
            
        # Ensure purchase date is after join date
        max_possible_recency = (analysis_date - join_date).days
        if recency_days >= max_possible_recency:
            recency_days = max(1, max_possible_recency - 5)
            
        lp_date = analysis_date - timedelta(days=recency_days)
        last_purchase_dates.append(lp_date.strftime("%Y-%m-%d"))
        total_orders.append(orders)
        
        # Spend calculations with regional variance
        region = cust_regions[i]
        region_multiplier = 1.0
        if region == "East":
            region_multiplier = random.uniform(1.05, 1.20)
        elif region == "West":
            region_multiplier = random.uniform(0.95, 1.10)
        elif region == "North":
            region_multiplier = random.uniform(0.90, 1.05)
        elif region == "South":
            region_multiplier = random.uniform(0.80, 0.95)
            
        spend = round(orders * avg_order_value * region_multiplier, 2)
        total_spend.append(spend)
        
        # Determine Loyalty Status based on Spend (Realistic thresholds)
        if spend >= 3500:
            loyalty = "Platinum"
        elif spend >= 1200:
            loyalty = "Gold"
        elif spend >= 250:
            loyalty = "Silver"
        else:
            loyalty = "Bronze"
        loyalty_statuses.append(loyalty)
        
    # Create DataFrame
    print("Constructing DataFrame...")
    df = pd.DataFrame({
        "Customer ID": cust_ids,
        "Customer Name": customer_names,
        "Region": cust_regions,
        "Age Group": cust_ages,
        "Gender": cust_genders,
        "Customer Join Date": join_dates,
        "Last Purchase Date": last_purchase_dates,
        "Total Orders": total_orders,
        "Total Purchase Amount": total_spend,
        "Average Order Value": [round(spend / orders, 2) for spend, orders in zip(total_spend, total_orders)],
        "Product Category Preference": cust_categories,
        "Loyalty Status": loyalty_statuses
    })
    
    # Save CSV
    raw_path = "data/raw_customer_transactions.csv"
    print(f"Saving {len(df)} rows to {raw_path}...")
    df.to_csv(raw_path, index=False)
    print("Raw data generation completed successfully!")

if __name__ == "__main__":
    main()

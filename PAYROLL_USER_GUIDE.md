# Quick Reference: Using the Automated Payroll System

## For HR Admin: How to Process Payroll

### 1. **Set Payroll Period**
   - Go to Payroll page
   - Set **Month** and **Period** (1st-15th or 16th-End)
   - OR manually set **Start Date** and **End Date**

### 2. **Calculate Payroll**
   - Click **"Calculate Payroll"** button
   - System automatically:
     ✓ Reads all attendance records for the period
     ✓ Calculates work hours and payable days
     ✓ Calculates overtime hours
     ✓ Calculates late minutes from 7:30 AM

### 3. **Review Calculated Values**
   - **Employee Tab**: View work hours and basic pay
   - **Allowances Tab**: View housing, travel, meal, hazard pay
   - **Deductions Tab**: View late, SSS, PhilHealth, Pag-IBIG, loan deductions
   - **Masters Tab**: View complete payroll summary with totals

### 4. **Make Manual Adjustments (If Needed)**
   - Click **Edit** icon in Allowances or Deductions tab
   - Change any value you want to override
   - Click **Save Changes**
   - Your manual value will be used instead of auto-calculation

### 5. **Save Payroll**
   - Click **"Save Entire Payroll"** to store in database

### 6. **Generate Payslips**
   - **For Individual Distribution**: Click "Generate Payslips"
     - Choose format: Individual PDFs, Email, or Excel
     - Select month and period
     - Choose employees or select all
   
   - **For Accounting Department**: Click "Payslips for Accounting"
     - Generates single Excel file with all employee payroll details
     - Perfect for accounting team review

---

## Automatic Calculations Explained

### Overtime Example (4.5 hours overtime, 700/day rate)
```
Step 1: Calculate hourly rate
        700 ÷ 8 = 87.5 per hour

Step 2: Multiply by overtime hours
        87.5 × 4.5 = 393.75
        
Result: Overtime Pay = 393.75
```

### Late Deduction Example (30 minutes late, 700/day rate)
```
Step 1: Calculate per-minute rate
        700 ÷ 8 = 87.5 per hour
        87.5 ÷ 60 = 1.458333 per minute

Step 2: Multiply by late minutes
        1.458333 × 30 = 43.75
        
Result: Late Deduction = 43.75
```

### Allowances Example (4 days worked, 700/day rate)
```
Housing: 700 × 10% × 4 = 280
Travel:  100 × 4 = 400
Meal:    80 × 4 = 320
Hazard:  700 × 25% × 4 = 700
```

---

## Key Points to Remember

⚠️ **Allowances Only Apply If Employee Worked**
- If `Payable Days = 0`, allowances are NOT calculated
- This prevents phantom deductions for no-show employees

✅ **Loan Deductions Are Automatic**
- If employee has approved loan: monthly payment is automatically deducted
- You don't need to manually enter it

✅ **Manual Overrides Preserved**
- If you edit a value, system uses YOUR value
- Won't recalculate it automatically
- Useful for exceptions or special cases

✅ **Call Time is 7:30 AM**
- Any check-in after 7:30 AM is marked as late
- Late minutes calculated from 7:30 AM threshold

---

## Troubleshooting

**Q: Why are allowances showing as 0?**
A: Employee likely has no payable days (no attendance for the period). System prevents phantom allowances.

**Q: Can I manually change calculated values?**
A: Yes! Click the Edit button in the Allowances or Deductions tab to override any value.

**Q: Does the system recalculate after I save?**
A: No. Once you manually set a value, it's locked. To reset to auto-calculated, delete the value and recalculate payroll.

**Q: How do I send payslips to the accounting department?**
A: Click "Payslips for Accounting" button. It generates an Excel file with all employee payroll details ready for accounting review.

**Q: What if an employee has an approved loan?**
A: The monthly loan repayment is automatically deducted from their paycheck. You'll see it in the "Deductions Tab" under "Loan Payment".

---

## Tips for Efficient Payroll Processing

1. **Process by Period**: Always calculate for a complete period (1-15 or 16-30/31)
2. **Verify Attendance**: Ensure attendance data is accurate BEFORE calculating payroll
3. **Review Totals**: Check the Masters tab totals before saving
4. **Save Before Export**: Save the payroll first, then generate payslips
5. **Export for Accounting**: Always export to Excel for the accounting team's records

---

**Remember**: The system is designed to automatically calculate based on your exact formulas. You only need to edit if there are special circumstances or corrections needed.

# Performance Management Survey - Setup & Testing Guide

## ✅ All Components Implemented

### 1. UI Components Added

#### Survey Form Section (`performance.html`)
- Dynamic slider controls for 3 KPIs:
  - Technical Skills & Expertise (1-5)
  - Task Completion & Delivery (1-5)
  - Teamwork & Collaboration (1-5)
- Text input fields for:
  - Key Achievements (textarea)
  - Challenges & Improvements (textarea)
  - Goals for Next Period (textarea)
- Real-time summary card showing:
  - Average Score (0-5)
  - Percentage Score (0-100%)
  - Performance Level (Excellent/Very Good/Good/Satisfactory/Needs Improvement)
- Three action buttons:
  - Submit Survey
  - Google Form (opens external form)
  - Reset Form

#### Google Forms Modal
- Allows pasting Google Form URL
- Opens form in new window when URL provided

### 2. JavaScript Functions Implemented

#### Survey Functions (`index.html` - performance section)
```javascript
// Updates real-time scores and badges
updateSurveyScore()

// Submits form data to API
submitPerformanceSurvey()

// Google Forms modal controls
openGoogleFormModal()
closeGoogleFormModal()
openGoogleForm()

// Enhanced functions
showPerformanceSection() - Updated to handle survey tab
loadEmployeeKPI() - Now fetches and displays survey data
```

### 3. Backend API Endpoints

#### POST /api/survey-response
**Request:**
```json
{
  "email": "employee@hospital.com",
  "technical_skill": 4,
  "task_completion": 5,
  "teamwork": 4,
  "achievements": "Led successful project X",
  "challenges": "Time management on multiple tasks",
  "next_goal": "Complete certification training"
}
```

**Response:**
```json
{
  "message": "Performance Data Saved Successfully"
}
```

#### GET /api/survey-response?email=name
**Returns Latest Survey:**
```json
{
  "_id": "...",
  "email": "Dr. Sarah Johnson",
  "technical_skill": 4,
  "task_completion": 5,
  "teamwork": 4,
  "average_score": "4.33",
  "percentage_score": 87,
  "performance_level": "Very Good",
  "achievements": "Led successful project X",
  "challenges": "Time management on multiple tasks",
  "next_goal": "Complete certification training",
  "submittedAt": "2024-01-15T10:30:00Z"
}
```

## 📋 Testing Checklist

### Test 1: Load Performance Page
- [ ] Navigate to Admin > Performance page
- [ ] Verify employee list loads
- [ ] First employee auto-selected
- [ ] Click "Survey" button in menu

### Test 2: Survey Form Display
- [ ] Survey section appears
- [ ] All sliders visible and functional
- [ ] Real-time score update works
- [ ] Summary card updates as sliders move

### Test 3: Performance Level Badges
- [ ] 90%+ = Shows "Excellent" (green)
- [ ] 75-89% = Shows "Very Good" (blue)
- [ ] 60-74% = Shows "Good" (yellow)
- [ ] 40-59% = Shows "Satisfactory" (orange)
- [ ] <40% = Shows "Needs Improvement" (red)

### Test 4: Submit Survey
- [ ] Fill in all fields
- [ ] Click "Submit Survey"
- [ ] Should see success message
- [ ] Form resets
- [ ] Check browser console for no errors

### Test 5: Data Persistence
- [ ] After submission, click to another employee
- [ ] Click back to original employee
- [ ] KPI Score should show survey percentage
- [ ] Review Rating should show average score

### Test 6: Google Forms Integration
- [ ] Click "Google Form" button
- [ ] Modal appears with URL input
- [ ] Paste a valid Google Form URL
- [ ] Click "Open Form"
- [ ] Form opens in new tab

### Test 7: Reset Form
- [ ] Adjust sliders and fill text fields
- [ ] Click "Reset" button
- [ ] All fields return to defaults
- [ ] Score shows 0

## 🔧 Configuration

### Database
- Collection: `SurveyResponse`
- Stores: email, scores (1-5), text feedback, calculated metrics
- Indexed by: email, submittedAt (for latest fetch)

### Score Calculations
- **Average:** (technical_skill + task_completion + teamwork) / 3
- **Percentage:** (average / 5) × 100
- **Level:** Determined by percentage ranges above

## 🚀 Usage Workflow

1. **Admin selects employee** → Click employee name in sidebar
2. **View performance** → Current KPI data loads
3. **Click Survey tab** → Survey form appears
4. **Rate performance** → Use sliders (1-5)
5. **Add feedback** → Fill in achievements, challenges, goals
6. **Submit** → Data saved to database
7. **Verify update** → KPI Score and Review Rating update automatically

## 📊 Data Validation

All inputs are validated:
- Sliders: 1-5 (enforced by HTML)
- Email: Auto-populated from selected employee
- Textareas: Accept any text (optional)

## 🐛 Troubleshooting

**Survey not saving?**
- Check browser console for errors
- Verify API endpoint is `/api/survey-response`
- Ensure employee email is correctly populated

**Scores not updating?**
- Hard refresh page (Ctrl+F5)
- Check loadEmployeeKPI function is called
- Verify survey exists in database

**Google Form not opening?**
- Paste complete URL including https://
- Check URL format: https://docs.google.com/forms/d/...

## 📝 Next Steps

1. Test with live server
2. Verify MongoDB connection for SurveyResponse collection
3. Add survey history/archive feature
4. Create admin dashboard showing survey trends
5. Export survey data to Excel

---
**Created:** 2024
**Status:** Ready for Testing

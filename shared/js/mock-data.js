// Central mock data store for both apps

export const MOCK_GUARDIAN = {
  token: 'mock-token-guardian-abc123',
  name: 'মোহাম্মদ আবদুল করিম',
  phone: '01712345678',
  imageUrl: null,
  children: [
    {
      studentIID: 1001,
      studentInsId: 'MH-2024-001',
      fullName: 'আবদুল্লাহ করিম',
      fullNameEn: 'Abdullah Karim',
      roll: '05',
      className: 'দাখিল ৯ম',
      classId: 9,
      section: 'আলিম',
      sectionId: 1,
      todayAttendance: 'Present',
      homeworkPending: 3,
      feesDue: 2500,
      noticeUnread: 2,
      hasUpcomingExam: true,
      avatarColor: '#10b981'
    },
    {
      studentIID: 1002,
      studentInsId: 'MH-2024-002',
      fullName: 'ফাতেমা করিম',
      fullNameEn: 'Fatema Karim',
      roll: '12',
      className: 'দাখিল ৭ম',
      classId: 7,
      section: 'আলিম',
      sectionId: 1,
      todayAttendance: 'Absent',
      homeworkPending: 1,
      feesDue: 0,
      noticeUnread: 1,
      hasUpcomingExam: false,
      avatarColor: '#8b5cf6'
    },
    {
      studentIID: 1003,
      studentInsId: 'MH-2024-003',
      fullName: 'ইউসুফ করিম',
      fullNameEn: 'Yusuf Karim',
      roll: '08',
      className: 'দাখিল ৫ম',
      classId: 5,
      section: 'বি',
      sectionId: 2,
      todayAttendance: 'Present',
      homeworkPending: 0,
      feesDue: 1200,
      noticeUnread: 0,
      hasUpcomingExam: true,
      avatarColor: '#f59e0b'
    }
  ]
};

export const MOCK_TEACHER = {
  token: 'mock-token-teacher-xyz789',
  empId: 'T-2024-015',
  fullName: 'মোহাম্মদ ইব্রাহিম হোসেন',
  designation: 'সহকারী শিক্ষক',
  className: 'দাখিল ৯ম',
  section: 'আলিম',
  mobileNumber: '01987654321',
  imageUrl: null,
  role: 'Teacher', // Teacher | Principal | VicePrincipal | Admin
};

export const MOCK_PRINCIPAL = {
  ...MOCK_TEACHER,
  token: 'mock-token-principal-ppp000',
  fullName: 'মাওলানা আবদুর রহমান',
  designation: 'অধ্যক্ষ',
  role: 'Principal',
};

export const MOCK_ATTENDANCE = {
  today: [
    { studentIID: 101, name: 'আহমাদ হাসান', roll: '01', status: 'Present' },
    { studentIID: 102, name: 'মুহাম্মাদ আলী', roll: '02', status: 'Present' },
    { studentIID: 103, name: 'ইব্রাহিম খলিল', roll: '03', status: 'Absent' },
    { studentIID: 104, name: 'ইসমাইল হোসেন', roll: '04', status: 'Late' },
    { studentIID: 105, name: 'উমর ফারুক', roll: '05', status: 'Present' },
    { studentIID: 106, name: 'আলী আকবর', roll: '06', status: 'Leave' },
    { studentIID: 107, name: 'হাসান মাহমুদ', roll: '07', status: 'Present' },
    { studentIID: 108, name: 'হুসাইন আহমেদ', roll: '08', status: 'Present' },
    { studentIID: 109, name: 'ইয়াহিয়া রহমান', roll: '09', status: 'Present' },
    { studentIID: 110, name: 'দাউদ ইসলাম', roll: '10', status: 'Absent' },
    { studentIID: 111, name: 'সুলায়মান হক', roll: '11', status: 'Present' },
    { studentIID: 112, name: 'মুসা করিম', roll: '12', status: 'Present' },
  ],
  history: [
    { date: '2026-06-23', status: 'Present' },
    { date: '2026-06-22', status: 'Present' },
    { date: '2026-06-21', status: 'Absent' },
    { date: '2026-06-20', status: 'Present' },
    { date: '2026-06-19', status: 'Leave' },
    { date: '2026-06-18', status: 'Present' },
    { date: '2026-06-17', status: 'Present' },
    { date: '2026-06-16', status: 'Late' },
    { date: '2026-06-15', status: 'Present' },
    { date: '2026-06-14', status: 'Present' },
    { date: '2026-06-13', status: 'Present' },
    { date: '2026-06-12', status: 'Absent' },
  ]
};

export const MOCK_HOMEWORK = [
  {
    id: 'hw001',
    title: 'আরবি ব্যাকরণ অনুশীলন',
    subject: 'আরবি',
    subjectId: 1,
    description: '<p>পাঠ্যপুস্তকের ১৫-২০ পৃষ্ঠা পড়ো এবং ব্যায়াম ৩ সম্পন্ন করো।</p>',
    assignedDate: '2026-06-20',
    dueDate: '2026-06-25',
    status: 'Pending',
    teacherName: 'মোহাম্মদ ইব্রাহিম হোসেন',
    hasVoiceNote: true,
    hasImage: true,
    submittedAt: null,
    teacherFeedback: null,
  },
  {
    id: 'hw002',
    title: 'কুরআন তিলাওয়াত অনুশীলন',
    subject: 'কুরআন',
    subjectId: 2,
    description: '<p>সূরা বাকারা ১-১০ আয়াত মুখস্থ করো।</p>',
    assignedDate: '2026-06-18',
    dueDate: '2026-06-24',
    status: 'Pending',
    teacherName: 'হাফেজ আবদুল হামিদ',
    hasVoiceNote: false,
    hasImage: false,
    submittedAt: null,
    teacherFeedback: null,
  },
  {
    id: 'hw003',
    title: 'গণিত অনুশীলন সেট ৫',
    subject: 'গণিত',
    subjectId: 3,
    description: '<p>পৃষ্ঠা ৪৫-৪৮, সমস্ত অনুশীলনী সমাধান করো।</p>',
    assignedDate: '2026-06-15',
    dueDate: '2026-06-22',
    status: 'Submitted',
    teacherName: 'মোহাম্মদ রফিকুল ইসলাম',
    hasVoiceNote: false,
    hasImage: true,
    submittedAt: '2026-06-22',
    teacherFeedback: {
      reaction: 'Excellent',
      note: 'চমৎকার কাজ! হাতের লেখা সুন্দর এবং সব সমস্যা সঠিক।'
    }
  },
  {
    id: 'hw004',
    title: 'বাংলা রচনা',
    subject: 'বাংলা',
    subjectId: 4,
    description: '<p>"আমার প্রিয় ঋতু" বিষয়ে ২০০ শব্দের রচনা লেখো।</p>',
    assignedDate: '2026-06-17',
    dueDate: '2026-06-21',
    status: 'Submitted',
    teacherName: 'মোসাম্মৎ রহিমা বেগম',
    hasVoiceNote: true,
    hasImage: false,
    submittedAt: '2026-06-20',
    teacherFeedback: {
      reaction: 'Good',
      note: 'ভালো লিখেছ, তবে বানান আরও সতর্কতার সাথে দেখতে হবে।'
    }
  }
];

export const MOCK_LEAVES = [
  {
    id: 'lv001',
    studentName: 'আবদুল্লাহ করিম',
    class: 'দাখিল ৯ম',
    section: 'আলিম',
    fromDate: '2026-06-19',
    toDate: '2026-06-19',
    type: 'অসুস্থতা',
    description: 'জ্বর ও সর্দির কারণে স্কুলে আসতে পারবে না।',
    status: 'Approved',
    appliedAt: '2026-06-18',
    actionBy: 'শিক্ষক',
  },
  {
    id: 'lv002',
    studentName: 'আবদুল্লাহ করিম',
    class: 'দাখিল ৯ম',
    section: 'আলিম',
    fromDate: '2026-06-28',
    toDate: '2026-06-29',
    type: 'পারিবারিক',
    description: 'পারিবারিক অনুষ্ঠানের কারণে।',
    status: 'Pending',
    appliedAt: '2026-06-24',
    actionBy: null,
  },
  {
    id: 'lv003',
    studentName: 'আহমাদ হাসান',
    class: 'দাখিল ৯ম',
    section: 'আলিম',
    fromDate: '2026-06-25',
    toDate: '2026-06-26',
    type: 'অসুস্থতা',
    description: 'পেট ব্যথার কারণে।',
    status: 'Pending',
    appliedAt: '2026-06-24',
    actionBy: null,
  },
  {
    id: 'lv004',
    studentName: 'মুহাম্মাদ আলী',
    class: 'দাখিল ৯ম',
    section: 'আলিম',
    fromDate: '2026-06-20',
    toDate: '2026-06-21',
    type: 'বিবিধ',
    description: 'ভাইয়ের বিবাহ।',
    status: 'EscalatedToPrincipal',
    appliedAt: '2026-06-19',
    actionBy: 'শিক্ষক',
  },
  {
    id: 'lv005',
    studentName: 'ইব্রাহিম খলিল',
    class: 'দাখিল ৯ম',
    section: 'আলিম',
    fromDate: '2026-06-10',
    toDate: '2026-06-11',
    type: 'অসুস্থতা',
    description: 'ডায়রিয়া।',
    status: 'Rejected',
    appliedAt: '2026-06-09',
    actionBy: 'শিক্ষক',
  }
];

export const MOCK_FEES = {
  due: [
    { month: 'জুন ২০২৬', head: 'মাসিক বেতন', amount: 1500, dueDate: '2026-06-15' },
    { month: 'মে ২০২৬', head: 'পরীক্ষার ফি', amount: 1000, dueDate: '2026-05-30' },
  ],
  history: [
    { month: 'এপ্রিল ২০২৬', head: 'মাসিক বেতন', amount: 1500, paidDate: '2026-04-10', method: 'bKash' },
    { month: 'মার্চ ২০২৬', head: 'মাসিক বেতন', amount: 1500, paidDate: '2026-03-08', method: 'নগদ' },
    { month: 'ফেব্রুয়ারি ২০২৬', head: 'মাসিক বেতন', amount: 1500, paidDate: '2026-02-12', method: 'bKash' },
    { month: 'ফেব্রুয়ারি ২০২৬', head: 'বার্ষিক ফি', amount: 3000, paidDate: '2026-02-12', method: 'নগদ' },
  ],
  classDue: [
    { class: 'দাখিল ৯ম আলিম', totalStudents: 38, dueStudents: 12, totalDue: 18000 },
    { class: 'দাখিল ৮ম আলিম', totalStudents: 42, dueStudents: 8, totalDue: 12000 },
    { class: 'দাখিল ৭ম আলিম', totalStudents: 35, dueStudents: 15, totalDue: 22500 },
    { class: 'দাখিল ৬ষ্ঠ বি', totalStudents: 40, dueStudents: 5, totalDue: 7500 },
  ],
  studentDue: [
    { studentIID: 101, name: 'আহমাদ হাসান', roll: '01', amount: 1500 },
    { studentIID: 103, name: 'ইব্রাহিম খলিল', roll: '03', amount: 2500 },
    { studentIID: 106, name: 'আলী আকবর', roll: '06', amount: 1500 },
    { studentIID: 108, name: 'হুসাইন আহমেদ', roll: '08', amount: 3000 },
    { studentIID: 110, name: 'দাউদ ইসলাম', roll: '10', amount: 1500 },
  ]
};

export const MOCK_EXAM_RESULTS = [
  { subject: 'আরবি', fullMarks: 100, passMarks: 33, obtained: 78, grade: 'A', gradePoint: 4.0 },
  { subject: 'কুরআন', fullMarks: 100, passMarks: 33, obtained: 92, grade: 'A+', gradePoint: 5.0 },
  { subject: 'বাংলা', fullMarks: 100, passMarks: 33, obtained: 65, grade: 'B', gradePoint: 3.5 },
  { subject: 'ইংরেজি', fullMarks: 100, passMarks: 33, obtained: 55, grade: 'C', gradePoint: 3.0 },
  { subject: 'গণিত', fullMarks: 100, passMarks: 33, obtained: 82, grade: 'A', gradePoint: 4.0 },
  { subject: 'বিজ্ঞান', fullMarks: 100, passMarks: 33, obtained: 70, grade: 'A-', gradePoint: 3.75 },
  { subject: 'সমাজ বিজ্ঞান', fullMarks: 100, passMarks: 33, obtained: 68, grade: 'A-', gradePoint: 3.75 },
];

export const MOCK_EXAM_ROUTINE = [
  { date: '2026-07-01', day: 'বুধবার', subject: 'আরবি', time: '৯:০০ - ১২:০০', room: 'হল-১' },
  { date: '2026-07-03', day: 'শুক্রবার', subject: 'কুরআন', time: '৯:০০ - ১২:০০', room: 'হল-১' },
  { date: '2026-07-05', day: 'রবিবার', subject: 'বাংলা', time: '৯:০০ - ১২:০০', room: 'হল-১' },
  { date: '2026-07-07', day: 'মঙ্গলবার', subject: 'ইংরেজি', time: '৯:০০ - ১২:০০', room: 'হল-২' },
  { date: '2026-07-09', day: 'বৃহস্পতিবার', subject: 'গণিত', time: '৯:০০ - ১২:০০', room: 'হল-১' },
];

export const MOCK_NOTICES = [
  {
    id: 'nt001',
    title: 'আর্ধবার্ষিক পরীক্ষার সময়সূচি প্রকাশ',
    category: 'Notice',
    date: '2026-06-22',
    content: 'আগামী ১ জুলাই থেকে আর্ধবার্ষিক পরীক্ষা শুরু হবে। সকল ছাত্রছাত্রীকে প্রস্তুত থাকতে অনুরোধ করা হচ্ছে।',
    isRead: false
  },
  {
    id: 'nt002',
    title: 'বার্ষিক ক্রীড়া প্রতিযোগিতা',
    category: 'Notice',
    date: '2026-06-18',
    content: '১৫ জুলাই মাদ্রাসার বার্ষিক ক্রীড়া প্রতিযোগিতা অনুষ্ঠিত হবে।',
    isRead: false
  },
  {
    id: 'nt003',
    title: 'অভিভাবক সভা আহবান',
    category: 'Circular',
    date: '2026-06-15',
    content: 'আগামী ২৮ জুন মাদ্রাসায় অভিভাবক সভা অনুষ্ঠিত হবে। সকল অভিভাবকদের উপস্থিত থাকার অনুরোধ করা হচ্ছে।',
    isRead: true
  },
  {
    id: 'nt004',
    title: 'ঈদ-উল-আযহা উপলক্ষে ছুটি',
    category: 'Circular',
    date: '2026-06-10',
    content: 'ঈদ-উল-আযহা উপলক্ষে ৬-১৩ জুলাই মাদ্রাসা বন্ধ থাকবে।',
    isRead: true
  },
  {
    id: 'nt005',
    title: 'বিজ্ঞান মেলা ২০২৬',
    category: 'Event',
    date: '2026-06-08',
    content: '২০ জুলাই মাদ্রাসা বিজ্ঞান মেলা অনুষ্ঠিত হবে।',
    isRead: true
  }
];

export const MOCK_CLASSES = [
  { classId: 5, className: 'দাখিল ৫ম' },
  { classId: 6, className: 'দাখিল ৬ষ্ঠ' },
  { classId: 7, className: 'দাখিল ৭ম' },
  { classId: 8, className: 'দাখিল ৮ম' },
  { classId: 9, className: 'দাখিল ৯ম' },
  { classId: 10, className: 'দাখিল ১০ম' },
];

export const MOCK_SECTIONS = [
  { sectionId: 1, className: 'আলিম' },
  { sectionId: 2, className: 'বি' },
];

export const MOCK_SUBJECTS = [
  { subjectId: 1, name: 'আরবি' },
  { subjectId: 2, name: 'কুরআন' },
  { subjectId: 3, name: 'গণিত' },
  { subjectId: 4, name: 'বাংলা' },
  { subjectId: 5, name: 'ইংরেজি' },
  { subjectId: 6, name: 'বিজ্ঞান' },
  { subjectId: 7, name: 'সমাজ বিজ্ঞান' },
];

export const MOCK_MARKS = [
  { roll: '01', name: 'আহমাদ হাসান', marks: 78 },
  { roll: '02', name: 'মুহাম্মাদ আলী', marks: 65 },
  { roll: '03', name: 'ইব্রাহিম খলিল', marks: 90 },
  { roll: '04', name: 'ইসমাইল হোসেন', marks: 55 },
  { roll: '05', name: 'উমর ফারুক', marks: 72 },
  { roll: '06', name: 'আলী আকবর', marks: 48 },
  { roll: '07', name: 'হাসান মাহমুদ', marks: 83 },
  { roll: '08', name: 'হুসাইন আহমেদ', marks: 61 },
  { roll: '09', name: 'ইয়াহিয়া রহমান', marks: 77 },
  { roll: '10', name: 'দাউদ ইসলাম', marks: 42 },
];

export const MOCK_TEACHER_DASHBOARD = {
  totalClasses: 6,
  attendancePending: 2,
  homeworkPendingReview: 8,
  leaveRequests: 3,
  feesDueStudents: 12,
};

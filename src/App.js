import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";

import TeacherLayout from "./components/TeacherLayout";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherProfile from "./pages/TeacherProfile";
import TeacherSettings from "./pages/TeacherSettings";

import StudentLayout from "./components/StudentLayout";
import StudentDashboard from "./pages/StudentDashboard";
import StudentProfile from "./pages/StudentProfile";
import StudentSettings from "./pages/StudentSettings";

import AddQuestion from "./pages/AddQuestion";
import ReviewQuestionTeacher from "./pages/ReviewQuestionTeacher";
import ReviewQuestionStudent from "./pages/ReviewQuestionStudent";
import DraftQuestion from "./pages/DraftQuestion";
import FeedbackQuestion from "./pages/FeedbackQuestion";
import ArchiveQuestion from "./pages/ArchiveQuestion";  
import ReportQuestionTeacher from "./pages/ReportQuestionTeacher";
import ReportQuestionStudent from "./pages/ReportQuestionStudent";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="add-question" element={<AddQuestion />} />
          <Route path="draft" element={<DraftQuestion />} />
          <Route path="review-question" element={<ReviewQuestionTeacher />} />
          <Route path="feedback-question" element={<FeedbackQuestion />} />
          <Route path="archive" element={<ArchiveQuestion />} />
          <Route path="report" element={<ReportQuestionTeacher />} />
          <Route path="profile" element={<TeacherProfile />} />
          <Route path="settings" element={<TeacherSettings />} />
        </Route>

        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="add-question" element={<AddQuestion />} />
          <Route path="review-question" element={<ReviewQuestionStudent />} />
          <Route path="feedback-question" element={<FeedbackQuestion />} />
          <Route path="report" element={<ReportQuestionStudent />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>

        
      </Routes>
    </BrowserRouter>
  );
}

export default App;
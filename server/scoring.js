export function normalizeExam(exam){return {...exam,total:exam.questions.reduce((sum,question)=>sum+question.score,0)}}

export type BeliefStatus='misconception'|'shaky'|'solid';
export type Belief={id:string;claim:string;confidence:number;status:BeliefStatus;x:number;y:number};
export type Topic={id:string;title:string;subject:string;level:string;hook:string;misconceptions:string[];mustHit:string[]};
export type Message={id:string;role:'teacher'|'student';text:string;time:string};
export type ExamItem={q:string;answer:string;score:number;why:string;beliefId:string};
export type Gap={messageId:string;quote:string;type:string;cost:number;fix:string};
export type Stage='welcome'|'setup'|'teach'|'exam'|'results';

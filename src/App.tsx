import {useStore} from './store';
import {Welcome} from './components/Welcome';
import {Setup} from './components/Setup';
import {Teaching} from './components/Teaching';
import {Exam} from './components/Exam';
import {Results} from './components/Results';
import {AuthenticationWall} from './components/AccountControl';
import {connectTokenGetter} from './auth/token';
import {useProtegeAuth} from './auth/context';
import {useEffect} from 'react';
import {LessonVault,PersistencePulse} from './components/LessonVault';

const views={welcome:Welcome,setup:Setup,teach:Teaching,exam:Exam,results:Results};

export function App(){
  const stage=useStore(s=>s.stage);
  const auth=useProtegeAuth();
  useEffect(()=>connectTokenGetter(auth.getToken),[auth.getToken]);
  const View=views[stage];
  if(stage!=='welcome'&&(!auth.configured||!auth.ready||!auth.signedIn))return <AuthenticationWall/>;
  return <div data-stage={stage}><View/>{stage==='welcome'?<LessonVault/>:<PersistencePulse/>}</div>;
}

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
import {Dashboard} from './components/Dashboard';
import {Settings} from './components/Settings';
import {usePreferences} from './lib/preferences';

const views={welcome:Welcome,dashboard:Dashboard,setup:Setup,teach:Teaching,exam:Exam,results:Results,settings:Settings};

export function App(){
  const stage=useStore(s=>s.stage);
  const auth=useProtegeAuth();
  const reducedMotion=usePreferences(state=>state.reducedMotion);const highContrast=usePreferences(state=>state.highContrast);
  useEffect(()=>connectTokenGetter(auth.getToken),[auth.getToken]);
  useEffect(()=>{document.documentElement.dataset.motion=reducedMotion?'reduced':'full';document.documentElement.dataset.contrast=highContrast?'high':'standard'},[reducedMotion,highContrast]);
  const View=views[stage];
  if(stage!=='welcome'&&(!auth.configured||!auth.ready||!auth.signedIn))return <AuthenticationWall/>;
  return <div data-stage={stage}><View/>{stage==='welcome'?<LessonVault/>:<PersistencePulse/>}</div>;
}

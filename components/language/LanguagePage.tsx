import React from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import LanguagePicker from './LanguagePicker';
export default function LanguagePage(){
  const navigate=useNavigate();
  const [params]=useSearchParams();
  const destination=params.get('returnTo');
  const next=destination&&/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(destination)?destination:'/crew';
  return <LanguagePicker onComplete={()=>navigate(next,{replace:true})}/>;
}

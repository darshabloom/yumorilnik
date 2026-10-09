"use client";
import {useEffect,useState} from "react";
export type SiteLanguage="ru"|"en";
const KEY="yumorilnik-language";
export function useSiteLanguage(){
 const [language,setLanguage]=useState<SiteLanguage>("ru");
 useEffect(()=>{
  const sync=()=>{const value=window.localStorage.getItem(KEY);setLanguage(value==="en"?"en":"ru");};
  sync();
  window.addEventListener("yumorilnik-language-change",sync);
  window.addEventListener("storage",sync);
  return()=>{window.removeEventListener("yumorilnik-language-change",sync);window.removeEventListener("storage",sync);};
 },[]);
 return language;
}

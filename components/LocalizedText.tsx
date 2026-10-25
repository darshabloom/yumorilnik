"use client";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
export default function LocalizedText({ru,en}:{ru:string;en:string}){return <>{useSiteLanguage()==="en"?en:ru}</>}

import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { publicSchoolGateway } from '@/lib/platform.functions';
import { pageHead } from '@/lib/metadata';
import { StaffSignIn } from '@/components/staff-sign-in';
const schoolOptions=(slug:string)=>queryOptions({queryKey:['school-gateway',slug],queryFn:()=>publicSchoolGateway({data:{slug}})});
export const Route=createFileRoute('/s/$school')({head:({params})=>pageHead(`School sign in: ${params.school}`,`Sign in through the ${params.school} school gateway on SchoolSys Pro.`),loader:({params,context})=>context.queryClient.ensureQueryData(schoolOptions(params.school)),component:Gateway});
function Gateway(){const {school}=Route.useParams();const {data}=useSuspenseQuery(schoolOptions(school));return data?<StaffSignIn schoolCode={data.code} schoolName={data.name}/>:<main className="p-10"><h1 className="text-2xl font-bold">School not found</h1></main>;}

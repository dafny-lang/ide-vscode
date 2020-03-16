method max(a:array<int>) returns(max:int)
 requires a!=null;
 ensures (forall j :int :: (j >= 0 && j < a.Length ==> max >= a[j]));
 ensures (a.Length > 0)==>(exists j : int :: j>=0 && j < a.Length && max==a[j]);
{
 if (a.Length == 0)  { max := 0;} 
 
 else {
 max:=a[0];
 var i:int :=1;
 while(i < a.Length)
 invariant (i<=a.Length) && (forall j:int :: j>=0 && j<i ==> max >= a[j])
         && (exists j:int :: j>=0 && j<i && max==a[j]);
 
 decreases (a.Length-i); 
 {
 if(a[i] > max){max := a[i];}
 i := i + 1;
 
 }
 }

 
} 
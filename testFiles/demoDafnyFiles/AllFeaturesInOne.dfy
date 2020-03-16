method MultipleReturns(inp1: int, inp2: int) 
   returns (more: int, less: int)
   ensures less < inp1 < more
{
   more := inp1 + inp2;
   less := inp1 - inp2;
   assert more == 0;
}
class ClassA {
   constructor () { }
   method myMethod() { /* do something */ }
}
method Main() {
   var myNumber := 1+2;
   var myClass := new ClassA();
   myClass.myMethod();
   
}

type memory = bv64 -> bv8

predicate pure(m: memory)
{
    forall i :: (m.reads(i) == {} && m.requires(i) == true)
}

function Write(m: memory, addr: bv64, val: bv8) : memory
    ensures pure(Write(m, addr, val));
{
    x reads m.reads(x) requires m.requires(x) => if x == addr then val else m(x)
}

method foo()
    ensures false
{ 
}
  

 
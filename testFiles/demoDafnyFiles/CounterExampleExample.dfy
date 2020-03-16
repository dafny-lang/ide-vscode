method MultipleReturns(inp1: int, inp2: int) returns (more: int, less: int)
   ensures less < inp1 < more
{
   more := inp1 + inp2;
   less := inp1 - inp2;
}
method sumAndMax(N: int, a: array<int>) returns (sum: int, max: int)
  requires 0 <= N && a != null && a.Length == N
  ensures sum <= N * max
{
  sum := 0;
  max := 0;
  var i := 0;
  while i < N
    invariant i <= N && sum <= i * max
  {
    if max < a[i] {
      max := a[i];
    }
    sum := sum + a[i];
    i := i + 1;
  }
}
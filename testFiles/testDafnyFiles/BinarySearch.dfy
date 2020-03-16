method BinarySearch(arr: array, key: int) returns (r: int)
  requires arr != null;
  requires forall i,j :: 0 <= i < j < arr.Length ==> arr[i] <= arr[j];
  ensures 0 <= r ==> r < arr.Length && arr[r] == key;
  ensures r < 0 ==> forall i :: 0 <= i < arr.Length ==> arr[i] != key;
{
  var lo, hi := 0, arr.Length;
  while lo < hi
    invariant 0 <= lo <= hi <= arr.Length;
    invariant forall i :: 0 <= i < lo ==> arr[i] != key;
    invariant forall i :: hi <= i < arr.Length ==> arr[i] != key;
    {
      var mid := (lo+hi) / 2;
      if arr[mid] < key {
        lo := mid + 1;
      } else if arr[mid] > key {
        hi := mid;
      } else if arr[mid] == key {
        return mid;
      }
    }
    return -1;
}
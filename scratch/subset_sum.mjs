function findSubsets(target, numbers, names) {
  const result = [];
  function search(idx, currentSum, currentSubset) {
    if (Math.abs(currentSum - target) < 0.1) {
      result.push([...currentSubset]);
    }
    if (currentSum > target + 0.1 || idx === numbers.length) return;
    
    // Include
    currentSubset.push(names[idx]);
    search(idx + 1, currentSum + numbers[idx], currentSubset);
    currentSubset.pop();
    
    // Exclude
    search(idx + 1, currentSum, currentSubset);
  }
  search(0, 0, []);
  return result;
}

const names = ['Eng1', 'Eng2', '2ndL', 'Bio', 'Phy', 'Chem', 'Math', 'Hist', 'Geog', 'Comp', 'GK', 'TL'];

const s1 = [75, 86, 77, 82, 84, 85, 84, 85, 75, 88, 93, 80];
console.log("Student 1 (Target 750):", findSubsets(750, s1, names));

const s2 = [91, 96, 86, 80, 94, 94, 90, 87, 89, 96, 96, 85];
console.log("Student 2 (Target 807):", findSubsets(807, s2, names));

const s3 = [88, 96, 91, 92, 89, 94, 91, 90, 89, 96, 98, 97];
console.log("Student 3 (Target 839):", findSubsets(839, s3, names));


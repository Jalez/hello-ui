/** @format */

const propertiesAndValues = {
	display: ['block', 'inline', 'inline-block', 'flex', 'grid'],
	position: ['absolute', 'relative', 'fixed', 'sticky'],
	width: ['400px', '100%', '50%'],
	height: ['300px', '100%', '50%'],
	gap: ['2px', '10px', '20px'],
	'grid-template-columns': 'grid-template-columns: ',
};

function generateGridAreasCSSString(
	selectors: string[],
	backgroundColor: string
) {
	let cssString = '';

	selectors.forEach((selector) => {
		cssString += `
      .${selector} {
        grid-area: ${selector};
        background-color: ${backgroundColor};
      }
    `;
	});

	return cssString;
}

export const generateGridLevel = (
	primaryColor: string,
	secondaryColor: string
) => {
	const columns = 3;
	const rows = 4;

	const selectors = ['one', 'two', 'three', 'four', 'five', 'six'];

	const gridMatrix = createRandomGrid(columns, rows, selectors);

	return {
		HTML: `<div class="wrapper">
  <div class="one">One</div>
  <div class="two">Two</div>
  <div class="three">Three</div>
  <div class="four">Four</div>
  <div class="five">Five</div>
  <div class="six">Six</div>
</div>`,
		TCSS: `
body {
  background-color: ${secondaryColor};
  width: 400px;
  height: 300px;
}
.wrapper {
	width: 100%;
	height: 100%;
}

div>div {
	background-color: ${primaryColor};
	font-size: 40px;
	text-align: center;
}

div>div:before {
	content: "";
	display: inline-block;
	height: 100%;
	vertical-align: middle;
}
`,
		SCSS: `
.wrapper {
	box-sizing: border-box;
  display: grid;
  gap: 2px;
  ${propertiesAndValues['grid-template-columns']} repeat(${columns}, 1fr);
  grid-template-rows: repeat(${rows}, 1fr);
  grid-template-areas:
    "${gridMatrix[1][0]} ${gridMatrix[1][1]} ${gridMatrix[1][2]}"
    "${gridMatrix[2][0]} ${gridMatrix[2][1]} ${gridMatrix[2][2]}"
    "${gridMatrix[3][0]} ${gridMatrix[3][1]} ${gridMatrix[3][2]}"
    "${gridMatrix[4][0]} ${gridMatrix[4][1]} ${gridMatrix[4][2]}";
}

${generateGridAreasCSSString(selectors, primaryColor)}
`,
	};
};
const createRandomGrid = (
	columns: number,
	rows: number,
	gridAreas: string[]
): { [key: number]: string[] } => {
	const gridMatrix: { [key: number]: string[] } = {
		1: ['.', '.', '.'],
		2: ['.', '.', '.'],
		3: ['.', '.', '.'],
		4: ['.', '.', '.'],
	};

	const availableMatrixIndexes: { [key: number]: number[] } = {
		1: [0, 1, 2],
		2: [0, 1, 2],
		3: [0, 1, 2],
		4: [0, 1, 2],
	};

	const availableRowIndexes: number[] = [1, 2, 3, 4];

	function isAvailable(
		row: number,
		col: number,
		direction: 'top' | 'right' | 'bottom' | 'left',
		availableRows: { [key: number]: number[] }
	): boolean {
		const adjacentRow =
			direction === 'top' ? row - 1 : direction === 'bottom' ? row + 1 : row;
		const adjacentCol =
			direction === 'left' ? col - 1 : direction === 'right' ? col + 1 : col;
		return (
			availableRows[adjacentRow] &&
			availableRows[adjacentRow].includes(adjacentCol)
		);
	}

	const checkRow = (rowIndex: number): void => {
		const rowColumns = availableMatrixIndexes[rowIndex];

		if (rowColumns.length === 0) {
			delete availableMatrixIndexes[rowIndex];
			availableRowIndexes.splice(availableRowIndexes.indexOf(rowIndex), 1);
		}
	};

	const getRowColValue = (columns: number[], colIndex: number): number => {
		return columns.splice(colIndex, 1)[0];
	};

	gridAreas.forEach((area, index) => {
		const startRowNum =
			availableRowIndexes[
				Math.floor(Math.random() * availableRowIndexes.length)
			];
		const availableColumns = availableMatrixIndexes[startRowNum];
		const colIndex = Math.floor(Math.random() * availableColumns.length);

		const startColumnNum = getRowColValue(availableColumns, colIndex);

		checkRow(startRowNum);

		let shouldExpand = Math.floor(Math.random() * 2) === 0 ? true : false;

		if (shouldExpand) {
			const directions: ('top' | 'right' | 'bottom' | 'left')[] = [
				'top',
				'right',
				'bottom',
				'left',
			];
			const availableDirections = directions.filter((dir) =>
				isAvailable(startRowNum, startColumnNum, dir, availableMatrixIndexes)
			);
			const direction =
				availableDirections[
					Math.floor(Math.random() * availableDirections.length)
				];

			switch (direction) {
				case 'top':
					gridMatrix[startRowNum - 1][startColumnNum] = area;
					// Remove the column from the available columns
					availableMatrixIndexes[startRowNum - 1].splice(startColumnNum, 1);
					checkRow(startRowNum - 1);
					break;
				case 'right':
					gridMatrix[startRowNum][startColumnNum + 1] = area;
					availableMatrixIndexes[startRowNum].splice(startColumnNum + 1, 1);
					checkRow(startRowNum);
					break;
				case 'bottom':
					gridMatrix[startRowNum + 1][startColumnNum] = area;
					availableMatrixIndexes[startRowNum + 1].splice(startColumnNum, 1);
					checkRow(startRowNum + 1);
					break;
				case 'left':
					gridMatrix[startRowNum][startColumnNum - 1] = area;
					availableMatrixIndexes[startRowNum].splice(startColumnNum - 1, 1);
					checkRow(startRowNum);
					break;
			}
		}
		gridMatrix[startRowNum][startColumnNum] = area;
	});
	return gridMatrix;
};

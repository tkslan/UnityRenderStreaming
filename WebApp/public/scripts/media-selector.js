export function setupMediaSelector(options, callback)
{
  const playerDiv = document.getElementById('player');
  let mediaSelectDiv = document.getElementById("mediaSelect");
  if(mediaSelectDiv != null)
    playerDiv.removeChild(mediaSelectDiv);
  mediaSelectDiv = document.createElement("div");
  mediaSelectDiv.id = "mediaSelect";
  mediaSelectDiv.setAttribute("style", "width:200px;");
  mediaSelectDiv.className = "custom-select";
  playerDiv.appendChild(mediaSelectDiv);
  const mediaSelect = document.createElement("select");
  mediaSelectDiv.appendChild(mediaSelect);
  let index = 0;
  options.forEach(option=>{
    let optionItem = document.createElement("Option");
    optionItem.value = index++;
    optionItem.innerHTML = option;
    mediaSelect.appendChild(optionItem);
  })


  let customSelects, selElmnt;
  /*look for any elements with the class "custom-select":*/
  customSelects = document.getElementsByClassName("custom-select");
  for (let i = 0; i < customSelects.length; i++) {
    selElmnt = customSelects[i].getElementsByTagName("select")[0];
    /*for each element, create a new DIV that will act as the selected item:*/
    let a = document.createElement("DIV");
    a.setAttribute("class", "select-selected");
    a.innerHTML = selElmnt.options[selElmnt.selectedIndex].innerHTML;
    customSelects[i].appendChild(a);
    /*for each element, create a new DIV that will contain the option list:*/
    let b = document.createElement("DIV");
    b.setAttribute("class", "select-items select-hide");
    for (let j = 1; j < selElmnt.length; j++) {
      /*for each option in the original select element,
      create a new DIV that will act as an option item:*/
      let c = document.createElement("DIV");
      c.innerHTML = selElmnt.options[j].innerHTML;
      c.addEventListener("click", function(e) {
        /*when an item is clicked, update the original select box,
        and the selected item:*/
        let y, i, k, s, h;
        s = this.parentNode.parentNode.getElementsByTagName("select")[0];

        //videoPlayer.selectMediaStream(this.innerHTML);
        callback(j-1);
        console.log(this.innerHTML);

        h = this.parentNode.previousSibling;
        for (i = 0; i < s.length; i++) {
          if (s.options[i].innerHTML == this.innerHTML) {
            s.selectedIndex = i;
            h.innerHTML = this.innerHTML;
            y = this.parentNode.getElementsByClassName("same-as-selected");
            for (k = 0; k < y.length; k++) {
              y[k].removeAttribute("class");
            }
            this.setAttribute("class", "same-as-selected");
            break;
          }
        }
        h.click();
      });
      b.appendChild(c);
    }
    customSelects[i].appendChild(b);
    a.addEventListener("click", function(e) {
      /*when the select box is clicked, close any other select boxes,
      and open/close the current select box:*/
      e.stopPropagation();
      closeAllSelect(this);
      this.nextSibling.classList.toggle("select-hide");
      this.classList.toggle("select-arrow-active");
    });
  }
  function closeAllSelect(elmnt) {
    /*a function that will close all select boxes in the document,
    except the current select box:*/
    var x, y, i, arrNo = [];
    x = document.getElementsByClassName("select-items");
    y = document.getElementsByClassName("select-selected");
    for (i = 0; i < y.length; i++) {
      if (elmnt == y[i]) {
        arrNo.push(i)
      } else {
        y[i].classList.remove("select-arrow-active");
      }
    }
    for (i = 0; i < x.length; i++) {
      if (arrNo.indexOf(i)) {
        x[i].classList.add("select-hide");
      }
    }
  }
  /*if the user clicks anywhere outside the select box,
  then close all select boxes:*/
  document.addEventListener("click", closeAllSelect);
}

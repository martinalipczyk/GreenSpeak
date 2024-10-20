function viewModal() {
    var myModal = new bootstrap.Modal(document.getElementById('uploadModal'));
    myModal.show();
}

function submitForm() {
    const authorName = document.getElementById('authorName').value;
    const description = document.getElementById('photoDescription').value;
    const imageInput = document.getElementById('imageUpload');
    const imageFile = imageInput.files[0];

    if (authorName && description && imageFile) {
        const reader = new FileReader();

        reader.onload = function (e) {
            const gallery = document.getElementById('gallery');
            const newImageDiv = document.createElement('div');
            newImageDiv.className = 'gallery-item';
            newImageDiv.innerHTML = `
                <img src="${e.target.result}" alt="${description}" class="gallery-img" />
                <div class="image-caption">
                    <strong>Author:</strong> ${authorName}<br>
                    <strong>Description:</strong> ${description}
                </div>
            `;
            gallery.appendChild(newImageDiv);
        };

        reader.readAsDataURL(imageFile);

        bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();

        document.getElementById('uploadForm').reset();
    } else {
        alert('Please fill out all fields and upload an image.');
    }
}
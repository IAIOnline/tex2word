<!-- удобная автоматическая конвертация LaTeX в word -->

To use

[tex2word](https://iaionline.github.io/tex2word/)


запуск
```[bash]
python server.py
```

убить сервер 
```[bash]
lsof -ti:8000 | xargs kill -9
```

This project is a web wrapper for the [tex2docx](https://github.com/jay-dennis/tex2docx) project, allowing all functionalities to operate through your browser. This provides simplicity and convenience, as no software installation is required on your local machine—everything will be done online.
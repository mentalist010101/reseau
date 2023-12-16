from django.shortcuts import render,redirect
from django.http import HttpResponse
from contacts.models import Contact
from contacts.forms import ContactForm
from django import forms

def accueil(request):
    return HttpResponse('<h2>Bienvenue sur notre apk<h2>')
def contact(request):
    contacts=Contact.objects.all()
    return render(request,'contacts/contact.html',{'contacts':contacts})
def contact_details(request,id):
    contacts=Contact.objects.get(id=id)
    return render(request,'contacts/contact_details.html',{'contacts':contacts})
def contact_ajouter(request):
    if request.method == 'POST':
        form=ContactForm(request.POST)
        if form.is_valid():
            contact=form.save()
            return redirect("/contact/")
    else:
        form=ContactForm()
    return render(request,'contacts/contact_ajouter.html',{'form':form})
def contact_change(request,id):
        contacts=Contact.objects.get(id=id)
        if request.method=='POST':
             form=ContactForm(request.POST)
             if form.is_valid():
                  form.save()
                  return redirect("contact/")
        else:
             form=ContactForm()
        return render(request,'contacts/contact_change.html',{'form':form})

def contact_delete(request,id):
    contacts=Contact.objects.get(id=id)
    if request.method=='POST':
        contacts.delete()
        return redirect("/contact/")
    
    return render (request,'contacts/contact_delete.html',{'contacts':contacts})

